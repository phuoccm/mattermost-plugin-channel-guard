// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
)

const channelConfigKeyPrefix = "cg:channel:"

// ChannelConfig is the per-channel state stored in the plugin KV store under
// key channelConfigKeyPrefix+channelID. JSON-serialised.
type ChannelConfig struct {
	Enabled bool     `json:"enabled"`
	Posters []string `json:"posters,omitempty"` // usernames, lowercase
}

func (cc *ChannelConfig) hasPoster(username string) bool {
	for _, u := range cc.Posters {
		if u == username {
			return true
		}
	}
	return false
}

func (p *Plugin) getChannelConfig(channelID string) (*ChannelConfig, *model.AppError) {
	raw, appErr := p.API.KVGet(channelConfigKeyPrefix + channelID)
	if appErr != nil {
		return nil, appErr
	}
	if raw == nil {
		return nil, nil
	}
	cc := &ChannelConfig{}
	if err := json.Unmarshal(raw, cc); err != nil {
		return nil, model.NewAppError("channel-guard", "kv.unmarshal", nil, err.Error(), 500)
	}
	return cc, nil
}

func (p *Plugin) setChannelConfig(channelID string, cc *ChannelConfig) *model.AppError {
	raw, err := json.Marshal(cc)
	if err != nil {
		return model.NewAppError("channel-guard", "kv.marshal", nil, err.Error(), 500)
	}
	return p.API.KVSet(channelConfigKeyPrefix+channelID, raw)
}
