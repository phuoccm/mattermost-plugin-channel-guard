// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

package main

import "strings"

// configuration mirrors the global plugin.json settings_schema. Per-channel state
// is kept separately in the KV store (see channel_config.go).
type configuration struct {
	AllowBots           bool
	RejectionMessage    string
	GlobalAlwaysAllowed string
}

func (c *configuration) Clone() *configuration {
	clone := *c
	return &clone
}

func (c *configuration) rejection() string {
	if msg := strings.TrimSpace(c.RejectionMessage); msg != "" {
		return msg
	}
	return "Only authorized members can start new messages in this channel. You can still reply within existing threads."
}

// globalAllowedSet returns usernames that bypass the per-channel allow list in
// every restricted channel. Tokens are lowercased and may be entered with or
// without a leading '@', separated by commas, spaces, or newlines.
func (c *configuration) globalAllowedSet() map[string]bool {
	out := make(map[string]bool)
	repl := strings.NewReplacer("\n", ",", "\r", ",", " ", ",", "\t", ",")
	for _, tok := range strings.Split(repl.Replace(c.GlobalAlwaysAllowed), ",") {
		tok = strings.TrimSpace(tok)
		tok = strings.TrimPrefix(tok, "@")
		if tok != "" {
			out[strings.ToLower(tok)] = true
		}
	}
	return out
}
