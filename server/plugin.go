// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin

	configurationLock sync.RWMutex
	configuration     *configuration
}

func (p *Plugin) getConfiguration() *configuration {
	p.configurationLock.RLock()
	defer p.configurationLock.RUnlock()

	if p.configuration == nil {
		return &configuration{}
	}
	return p.configuration
}

func (p *Plugin) setConfiguration(c *configuration) {
	p.configurationLock.Lock()
	defer p.configurationLock.Unlock()
	p.configuration = c
}

// OnConfigurationChange is called when an admin saves the global settings.
func (p *Plugin) OnConfigurationChange() error {
	c := &configuration{}
	if err := p.API.LoadPluginConfiguration(c); err != nil {
		return err
	}
	p.setConfiguration(c)
	return nil
}

// OnActivate is called when the plugin is enabled. Register the slash command here.
func (p *Plugin) OnActivate() error {
	return p.registerCommand()
}

// MessageWillBePosted runs server-side before every message is saved.
// Return (nil, message) to REJECT with a reason; return (post, "") to allow.
func (p *Plugin) MessageWillBePosted(_ *plugin.Context, post *model.Post) (*model.Post, string) {
	// Replies inside an existing thread are always allowed.
	if post.RootId != "" {
		return post, ""
	}

	cc, appErr := p.getChannelConfig(post.ChannelId)
	if appErr != nil {
		p.API.LogError("channel-guard: failed to read channel config; allowing post",
			"channel_id", post.ChannelId, "error", appErr.Error())
		return post, ""
	}
	if cc == nil || !cc.Enabled {
		return post, ""
	}

	user, appErr := p.API.GetUser(post.UserId)
	if appErr != nil {
		p.API.LogError("channel-guard: failed to load user; allowing post",
			"user_id", post.UserId, "error", appErr.Error())
		return post, ""
	}

	config := p.getConfiguration()

	if config.AllowBots && user.IsBot {
		return post, ""
	}
	if user.IsInRole(model.SystemAdminRoleId) {
		return post, ""
	}
	username := strings.ToLower(user.Username)
	if config.globalAllowedSet()[username] {
		return post, ""
	}
	if cc.hasPoster(username) {
		return post, ""
	}

	p.API.LogInfo("channel-guard: blocked root post",
		"channel_id", post.ChannelId,
		"user_id", user.Id,
		"username", username,
	)
	return nil, config.rejection()
}

func main() {
	plugin.ClientMain(&Plugin{})
}
