// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

package main

import "strings"

// configuration mirrors the global plugin.json settings_schema. Per-channel state
// is kept separately in the KV store (see channel_config.go).
type configuration struct {
	AllowBots        bool
	RejectionMessage string
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
