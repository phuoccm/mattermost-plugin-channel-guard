// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"encoding/json"
	"net/http"
	"sort"
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

// channelEntry is the per-channel admin payload returned by /api/v1/admin/channels.
type channelEntry struct {
	ID          string   `json:"id"`
	TeamID      string   `json:"team_id"`
	Name        string   `json:"name"`
	DisplayName string   `json:"display_name"`
	Type        string   `json:"type"`
	Enabled     bool     `json:"enabled"`
	Posters     []string `json:"posters"`
}

// channelConfigPayload is the body shape for PUT /api/v1/admin/channels/{id}.
type channelConfigPayload struct {
	Enabled bool     `json:"enabled"`
	Posters []string `json:"posters"`
}

// ServeHTTP routes the plugin's HTTP API. Mattermost serves these at
// /plugins/<plugin-id>/<path> with the caller's user id in the
// Mattermost-User-Id header (set from the session cookie).
func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")

	// User-facing: GET /api/v1/channels/{id}/restriction
	if r.Method == http.MethodGet &&
		len(parts) == 5 &&
		parts[0] == "api" && parts[1] == "v1" &&
		parts[2] == "channels" && parts[4] == "restriction" {
		p.handleRestriction(w, r, parts[3])
		return
	}

	// Admin: /api/v1/admin/channels[/{id}]
	if len(parts) >= 4 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "admin" && parts[3] == "channels" {
		userID := r.Header.Get("Mattermost-User-Id")
		if userID == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		user, appErr := p.API.GetUser(userID)
		if appErr != nil || user == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if !user.IsInRole(model.SystemAdminRoleId) {
			http.Error(w, "forbidden: system admin required", http.StatusForbidden)
			return
		}

		if r.Method == http.MethodGet && len(parts) == 4 {
			p.handleAdminListChannels(w, r)
			return
		}
		if len(parts) == 5 {
			switch r.Method {
			case http.MethodPut:
				p.handleAdminPutChannel(w, r, parts[4])
				return
			case http.MethodDelete:
				p.handleAdminDeleteChannel(w, r, parts[4])
				return
			}
		}
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
	username := strings.ToLower(user.Username)
	if config.globalAllowedSet()[username] {
		return out
	}
	if cc.hasPoster(username) {
		return out
	}

	out.Restricted = true
	out.Message = config.rejection()
	return out
}

func (p *Plugin) handleAdminListChannels(w http.ResponseWriter, _ *http.Request) {
	all, appErr := p.listChannelConfigs()
	if appErr != nil {
		http.Error(w, "kv.list: "+appErr.Error(), http.StatusInternalServerError)
		return
	}

	entries := make([]channelEntry, 0, len(all))
	for channelID, cc := range all {
		entry := channelEntry{
			ID:      channelID,
			Enabled: cc.Enabled,
			Posters: cc.Posters,
		}
		if entry.Posters == nil {
			entry.Posters = []string{}
		}
		ch, chErr := p.API.GetChannel(channelID)
		if chErr == nil && ch != nil {
			entry.TeamID = ch.TeamId
			entry.Name = ch.Name
			entry.DisplayName = ch.DisplayName
			entry.Type = string(ch.Type)
		}
		entries = append(entries, entry)
	}

	sort.Slice(entries, func(i, j int) bool {
		ni := strings.ToLower(entries[i].DisplayName)
		nj := strings.ToLower(entries[j].DisplayName)
		if ni == nj {
			return entries[i].ID < entries[j].ID
		}
		if ni == "" {
			return false
		}
		if nj == "" {
			return true
		}
		return ni < nj
	})

	writeJSON(w, entries)
}

func (p *Plugin) handleAdminPutChannel(w http.ResponseWriter, r *http.Request, channelID string) {
	var body channelConfigPayload
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json: "+err.Error(), http.StatusBadRequest)
		return
	}

	if _, chErr := p.API.GetChannel(channelID); chErr != nil {
		http.Error(w, "channel not found", http.StatusNotFound)
		return
	}

	clean := make([]string, 0, len(body.Posters))
	seen := make(map[string]bool)
	for _, raw := range body.Posters {
		u := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(raw, "@")))
		if u == "" || seen[u] {
			continue
		}
		seen[u] = true
		clean = append(clean, u)
	}
	sort.Strings(clean)

	cc := &ChannelConfig{Enabled: body.Enabled, Posters: clean}
	if appErr := p.setChannelConfig(channelID, cc); appErr != nil {
		http.Error(w, "kv.set: "+appErr.Error(), http.StatusInternalServerError)
		return
	}
	p.broadcastConfigChanged(channelID)
	p.API.LogInfo("channel-guard: admin set channel config",
		"channel_id", channelID,
		"enabled", cc.Enabled,
		"posters_count", len(cc.Posters),
		"actor", r.Header.Get("Mattermost-User-Id"),
	)

	w.WriteHeader(http.StatusNoContent)
}

func (p *Plugin) handleAdminDeleteChannel(w http.ResponseWriter, r *http.Request, channelID string) {
	if appErr := p.deleteChannelConfig(channelID); appErr != nil {
		http.Error(w, "kv.delete: "+appErr.Error(), http.StatusInternalServerError)
		return
	}
	p.broadcastConfigChanged(channelID)
	p.API.LogInfo("channel-guard: admin removed channel config",
		"channel_id", channelID,
		"actor", r.Header.Get("Mattermost-User-Id"),
	)
	w.WriteHeader(http.StatusNoContent)
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
