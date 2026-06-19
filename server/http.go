// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// restrictionResponse is what the webapp consumes to decide whether to hide the
// channel input box and reject root posts client-side.
type restrictionResponse struct {
	Restricted bool   `json:"restricted"`
	Message    string `json:"message,omitempty"`
}

// ServeHTTP exposes the plugin's HTTP API. Mattermost serves requests at
// /plugins/<plugin-id>/<path> and adds the Mattermost-User-Id header when the
// caller has a valid session.
func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	// expected: api/v1/channels/{id}/restriction
	if r.Method == http.MethodGet &&
		len(parts) == 5 &&
		parts[0] == "api" && parts[1] == "v1" &&
		parts[2] == "channels" && parts[4] == "restriction" {
		p.handleRestriction(w, r, parts[3])
		return
	}
	http.NotFound(w, r)
}

func (p *Plugin) handleRestriction(w http.ResponseWriter, r *http.Request, channelID string) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	writeJSON(w, p.computeRestriction(channelID, userID))
}

// computeRestriction mirrors the MessageWillBePosted logic but as a query,
// so the webapp can ask "can this user start a new message here?" before any input.
func (p *Plugin) computeRestriction(channelID, userID string) restrictionResponse {
	out := restrictionResponse{}

	cc, appErr := p.getChannelConfig(channelID)
	if appErr != nil || cc == nil || !cc.Enabled {
		return out
	}

	user, appErr := p.API.GetUser(userID)
	if appErr != nil || user == nil {
		return out
	}

	config := p.getConfiguration()
	if config.AllowBots && user.IsBot {
		return out
	}
	if user.IsInRole(model.SystemAdminRoleId) {
		return out
	}
	if cc.hasPoster(strings.ToLower(user.Username)) {
		return out
	}

	out.Restricted = true
	out.Message = config.rejection()
	return out
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// broadcastConfigChanged tells every connected client to re-query the
// restriction state for a channel (after enable/disable/add/remove).
func (p *Plugin) broadcastConfigChanged(channelID string) {
	p.API.PublishWebSocketEvent(
		"config_changed",
		map[string]interface{}{"channel_id": channelID},
		&model.WebsocketBroadcast{ChannelId: channelID},
	)
}
