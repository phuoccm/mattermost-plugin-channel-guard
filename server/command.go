// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"fmt"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

const commandTrigger = "channel-guard"

func (p *Plugin) registerCommand() error {
	return p.API.RegisterCommand(&model.Command{
		Trigger:          commandTrigger,
		DisplayName:      "Channel Guard",
		Description:      "Restrict who can start new messages in this channel.",
		AutoComplete:     true,
		AutoCompleteDesc: "Restrict who can start new messages in this channel (replies always allowed).",
		AutoCompleteHint: "[enable|disable|add|remove|list|help]",
		AutocompleteData: buildAutocomplete(),
	})
}

func buildAutocomplete() *model.AutocompleteData {
	root := model.NewAutocompleteData(commandTrigger, "[subcommand]",
		"Restrict who can start new messages in this channel. Replies are always allowed.")

	root.AddCommand(model.NewAutocompleteData(
		"enable", "",
		"Turn Channel Guard ON for THIS channel. Example: /channel-guard enable"))

	root.AddCommand(model.NewAutocompleteData(
		"disable", "",
		"Turn Channel Guard OFF for THIS channel (the allowed posters list is kept). Example: /channel-guard disable"))

	add := model.NewAutocompleteData(
		"add", "@user [@user2 ...]",
		"Allow these users to start new messages in THIS channel. Example: /channel-guard add @alice @bob")
	add.AddTextArgument("One or more usernames, space separated, with or without @", "@alice @bob", "")
	root.AddCommand(add)

	rm := model.NewAutocompleteData(
		"remove", "@user [@user2 ...]",
		"Revoke posting permission for these users in THIS channel. Example: /channel-guard remove @alice")
	rm.AddTextArgument("One or more usernames, space separated, with or without @", "@alice", "")
	root.AddCommand(rm)

	root.AddCommand(model.NewAutocompleteData(
		"list", "",
		"Show Channel Guard status and allowed posters for THIS channel."))

	root.AddCommand(model.NewAutocompleteData(
		"help", "",
		"Show usage examples."))

	return root
}

// ExecuteCommand dispatches /channel-guard subcommands. Always returns an ephemeral reply.
func (p *Plugin) ExecuteCommand(_ *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	fields := strings.Fields(args.Command)
	if len(fields) == 0 || !strings.HasPrefix(fields[0], "/"+commandTrigger) {
		return &model.CommandResponse{}, nil
	}

	if !p.canConfigure(args.UserId, args.ChannelId) {
		return ephemeral("You need to be a Channel Admin or System Admin to configure Channel Guard."), nil
	}

	sub := ""
	if len(fields) > 1 {
		sub = strings.ToLower(fields[1])
	}
	rest := fields[2:]

	switch sub {
	case "enable":
		return p.cmdEnable(args.ChannelId), nil
	case "disable":
		return p.cmdDisable(args.ChannelId), nil
	case "add":
		return p.cmdAdd(args.ChannelId, rest), nil
	case "remove":
		return p.cmdRemove(args.ChannelId, rest), nil
	case "list", "":
		return p.cmdList(args.ChannelId), nil
	case "help":
		return p.cmdHelp(), nil
	default:
		return ephemeral(fmt.Sprintf("Unknown subcommand `%s`. Try `/channel-guard help`.", sub)), nil
	}
}

func ephemeral(text string) *model.CommandResponse {
	return &model.CommandResponse{
		ResponseType: model.CommandResponseTypeEphemeral,
		Text:         text,
	}
}

func (p *Plugin) canConfigure(userID, channelID string) bool {
	user, appErr := p.API.GetUser(userID)
	if appErr != nil || user == nil {
		return false
	}
	if user.IsInRole(model.SystemAdminRoleId) {
		return true
	}
	cm, appErr := p.API.GetChannelMember(channelID, userID)
	if appErr != nil || cm == nil {
		return false
	}
	return cm.SchemeAdmin
}

func (p *Plugin) cmdEnable(channelID string) *model.CommandResponse {
	cc, appErr := p.getChannelConfig(channelID)
	if appErr != nil {
		return ephemeral("Error reading channel config: " + appErr.Error())
	}
	if cc == nil {
		cc = &ChannelConfig{}
	}
	cc.Enabled = true
	if appErr := p.setChannelConfig(channelID, cc); appErr != nil {
		return ephemeral("Error saving channel config: " + appErr.Error())
	}
	p.broadcastConfigChanged(channelID)
	msg := ":lock: Channel Guard is **enabled** for this channel."
	if len(cc.Posters) == 0 {
		msg += "\n\nNo users on the allowed list yet. Add some:\n```\n/channel-guard add @alice @bob\n```"
	} else {
		msg += "\nAllowed posters: " + formatPosters(cc.Posters)
	}
	return ephemeral(msg)
}

func (p *Plugin) cmdDisable(channelID string) *model.CommandResponse {
	cc, appErr := p.getChannelConfig(channelID)
	if appErr != nil {
		return ephemeral("Error reading channel config: " + appErr.Error())
	}
	if cc == nil {
		return ephemeral("Channel Guard is not configured for this channel.")
	}
	cc.Enabled = false
	if appErr := p.setChannelConfig(channelID, cc); appErr != nil {
		return ephemeral("Error saving channel config: " + appErr.Error())
	}
	p.broadcastConfigChanged(channelID)
	return ephemeral(":unlock: Channel Guard is **disabled** for this channel. The allowed posters list is preserved.")
}

func (p *Plugin) cmdAdd(channelID string, args []string) *model.CommandResponse {
	if len(args) == 0 {
		return ephemeral("Usage: `/channel-guard add @user1 @user2 ...`")
	}
	cc, appErr := p.getChannelConfig(channelID)
	if appErr != nil {
		return ephemeral("Error: " + appErr.Error())
	}
	if cc == nil {
		cc = &ChannelConfig{}
	}
	existing := map[string]bool{}
	for _, u := range cc.Posters {
		existing[u] = true
	}
	var added, alreadyIn, notFound []string
	for _, raw := range args {
		username := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(raw, "@")))
		if username == "" {
			continue
		}
		user, err := p.API.GetUserByUsername(username)
		if err != nil || user == nil {
			notFound = append(notFound, username)
			continue
		}
		if existing[username] {
			alreadyIn = append(alreadyIn, username)
			continue
		}
		cc.Posters = append(cc.Posters, username)
		existing[username] = true
		added = append(added, username)
	}
	sort.Strings(cc.Posters)

	if len(added) > 0 {
		if appErr := p.setChannelConfig(channelID, cc); appErr != nil {
			return ephemeral("Error saving: " + appErr.Error())
		}
		p.broadcastConfigChanged(channelID)
	}

	var parts []string
	if len(added) > 0 {
		parts = append(parts, ":white_check_mark: Added: "+formatPosters(added))
	}
	if len(alreadyIn) > 0 {
		parts = append(parts, ":information_source: Already allowed: "+formatPosters(alreadyIn))
	}
	if len(notFound) > 0 {
		parts = append(parts, ":warning: Not found: "+strings.Join(notFound, ", "))
	}
	if !cc.Enabled {
		parts = append(parts, "_Channel Guard is currently disabled — run `/channel-guard enable` to activate enforcement._")
	}
	if len(parts) == 0 {
		parts = append(parts, "No changes.")
	}
	return ephemeral(strings.Join(parts, "\n"))
}

func (p *Plugin) cmdRemove(channelID string, args []string) *model.CommandResponse {
	if len(args) == 0 {
		return ephemeral("Usage: `/channel-guard remove @user1 @user2 ...`")
	}
	cc, appErr := p.getChannelConfig(channelID)
	if appErr != nil {
		return ephemeral("Error: " + appErr.Error())
	}
	if cc == nil || len(cc.Posters) == 0 {
		return ephemeral("There are no allowed posters to remove.")
	}
	toRemove := map[string]bool{}
	for _, raw := range args {
		u := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(raw, "@")))
		if u != "" {
			toRemove[u] = true
		}
	}
	kept := cc.Posters[:0]
	var removed []string
	for _, u := range cc.Posters {
		if toRemove[u] {
			removed = append(removed, u)
		} else {
			kept = append(kept, u)
		}
	}
	cc.Posters = kept
	if appErr := p.setChannelConfig(channelID, cc); appErr != nil {
		return ephemeral("Error saving: " + appErr.Error())
	}
	if len(removed) == 0 {
		return ephemeral("No matching users on the allowed list.")
	}
	p.broadcastConfigChanged(channelID)
	return ephemeral(":x: Removed: " + formatPosters(removed))
}

func (p *Plugin) cmdList(channelID string) *model.CommandResponse {
	cc, appErr := p.getChannelConfig(channelID)
	if appErr != nil {
		return ephemeral("Error: " + appErr.Error())
	}
	if cc == nil {
		return ephemeral("Channel Guard is **not configured** for this channel.\n\nGet started:\n```\n/channel-guard enable\n/channel-guard add @alice @bob\n```")
	}
	status := ":unlock: disabled"
	if cc.Enabled {
		status = ":lock: **enabled**"
	}
	posters := "_(none)_"
	if len(cc.Posters) > 0 {
		posters = formatPosters(cc.Posters)
	}
	return ephemeral(fmt.Sprintf("Channel Guard: %s\nAllowed posters: %s", status, posters))
}

func (p *Plugin) cmdHelp() *model.CommandResponse {
	return ephemeral("**Channel Guard** — restrict who can start new messages in this channel. Replies inside threads are always allowed.\n\n" +
		"Subcommands (Channel Admin or System Admin only):\n" +
		"  • `/channel-guard enable` — turn on for this channel\n" +
		"  • `/channel-guard disable` — turn off (allowed list is kept)\n" +
		"  • `/channel-guard add @alice @bob` — allow users to start new messages\n" +
		"  • `/channel-guard remove @alice` — revoke\n" +
		"  • `/channel-guard list` — show current state\n\n" +
		"Example walkthrough:\n" +
		"```\n" +
		"/channel-guard enable\n" +
		"/channel-guard add @ceo @comms\n" +
		"/channel-guard list\n" +
		"```")
}

// formatPosters renders a list of usernames as `@alice, @bob` without triggering @-mentions
// (the backtick wrap prevents notification on the ephemeral output for other clients).
func formatPosters(users []string) string {
	if len(users) == 0 {
		return "_(none)_"
	}
	out := make([]string, len(users))
	for i, u := range users {
		out[i] = "`@" + u + "`"
	}
	return strings.Join(out, ", ")
}
