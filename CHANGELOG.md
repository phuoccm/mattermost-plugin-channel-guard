# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-06-19

Webapp UX layer added so blocked users never see the generic
"Retry / Cancel" modal after submitting. The server-side hook from 1.0.0
is unchanged and remains the source of truth.

### Added
- Webapp bundle (`webapp/dist/main.js`, vanilla JS, no build toolchain
  required) that subscribes to Redux channel changes and hides the
  center-channel message input via scoped CSS injection in restricted
  channels, replacing it with an explanatory banner.
- `registerMessageWillBePostedHook` on the webapp side as a
  belt-and-suspenders client-side guard in case the CSS hide has not
  kicked in yet during a page-load race.
- HTTP endpoint
  `GET /plugins/co.baxu.channel-guard/api/v1/channels/{channelId}/restriction`
  for the webapp to query whether the current user would be blocked in a
  given channel. Returns `{ "restricted": bool, "message": string }`.
- WebSocket broadcast
  `custom_co.baxu.channel-guard_config_changed` published after every
  successful `enable`, `disable`, `add`, or `remove` so connected clients
  refresh their state immediately without a page reload. The broadcast is
  scoped to the affected channel.
- 30-second client-side cache of restriction lookups per channel, with
  invalidation on the WebSocket event above, to keep the new endpoint
  cheap during rapid channel switching.

### Changed
- `plugin.json` now declares `webapp.bundle_path` pointing at
  `webapp/dist/main.js`.
- `build.sh` copies the webapp bundle into the tarball alongside the
  server binaries.
- `min_server_version` documented as `9.5.0+`; manually verified on
  Mattermost Team Edition 11.8.1.

## [1.0.0] - 2026-06-19

Initial public release.

### Added
- Server-side `MessageWillBePosted` hook that distinguishes new root
  messages (`RootId == ""`) from thread replies (`RootId != ""`) and
  gates only the former.
- Per-channel state persisted in the plugin KV store under
  `cg:channel:<channelId>` as JSON `{ "enabled": bool, "posters": [string] }`.
- Slash command `/channel-guard` with autocomplete and inline examples,
  bound from `OnActivate`:
  - `enable` / `disable` toggle the guard for the current channel; the
    allow list is preserved across `disable`.
  - `add @user [@user2 ...]` and `remove @user [@user2 ...]` manage the
    per-channel allow list. Usernames are accepted with or without `@`,
    space- or comma-separated. Unknown usernames are reported back.
  - `list` (also the default) shows the current state.
  - `help` prints full usage.
- Permission check: only Channel Admins
  (`ChannelMember.SchemeAdmin == true`) and System Admins may invoke the
  configuration subcommands. Other users receive an ephemeral error.
- Two global settings exposed in the System Console:
  - **Always allow bots / webhooks** (default `true`) lets bot accounts
    and incoming webhooks start new messages regardless of the
    per-channel allow list. Useful for announcement automation.
  - **Default rejection message** is shown inline to blocked users.
- Bypass rules in the hook: System Admins are always allowed; bots are
  allowed when the global setting is enabled; replies in threads are
  always allowed; the rejection message falls back to the default when
  the configured value is empty.
- Cross-platform server binaries: `linux/amd64`, `linux/arm64`,
  `darwin/amd64`, `darwin/arm64`, `windows/amd64`.
- Apache 2.0 `LICENSE`, `NOTICE` file, and `SPDX-License-Identifier:
  Apache-2.0` headers on every source file.
- `build.sh` runs entirely inside a `golang:1.26` Docker container, so
  the only host requirement is Docker. The tarball is packaged with
  GNU tar inside the container to avoid the pax extended headers that
  macOS BSD tar injects — those headers cause Mattermost to reject
  uploads with "Unable to find manifest for extracted plugin".

[Unreleased]: https://github.com/baxu/mattermost-plugin-channel-guard/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/baxu/mattermost-plugin-channel-guard/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/baxu/mattermost-plugin-channel-guard/releases/tag/v1.0.0
