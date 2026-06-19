# Security Policy

## Supported Versions

Only the latest minor release receives security fixes. Older minor versions
are not patched; please upgrade.

| Version  | Supported |
|----------|-----------|
| 1.2.x    | ✅ |
| < 1.2.0  | ❌ |

## Reporting a Vulnerability

**Please do not file a public GitHub issue for security vulnerabilities.**

Report security vulnerabilities by email to:

> **phuoccm@baxu.dev**

Include in your report:

- A short description of the issue and the affected components
  (server hook, slash command, HTTP endpoint, webapp).
- Steps to reproduce, ideally with a minimal proof of concept.
- The Mattermost server version, plugin version, and database engine
  you observed it on.
- Whether you would like to be credited in the release notes.

You can expect:

- An acknowledgement within **3 business days**.
- An assessment and target fix timeline within **10 business days**.
- A coordinated disclosure: a fix is shipped in a new release, the
  release notes describe the issue, and the reporter is credited
  (with consent).

## Hardening notes

This plugin authorises operations using:

- the `Mattermost-User-Id` request header on its HTTP endpoint
  (the Mattermost server sets it from the session cookie; the plugin
  rejects requests without it);
- `model.SystemAdminRoleId` and `ChannelMember.SchemeAdmin` for
  configuration changes;
- per-channel allow lists stored in the plugin KV store.

Enforcement of "who can start a new message" lives in the server-side
`MessageWillBePosted` hook and therefore applies to every client (web,
desktop, mobile, REST API). The webapp layer is a UX polish only and is
not relied on for security.
