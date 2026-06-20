// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

import type {ChannelEntry, ChannelConfigPayload} from './types';

const PLUGIN_ID = 'co.baxu.channel-guard';
const API = `/plugins/${PLUGIN_ID}/api/v1`;

const jsonHeaders = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
};

async function handle<T>(res: Response): Promise<T> {
    if (!res.ok) {
        let detail = '';
        try {
            detail = await res.text();
        } catch (e) {
            // ignore
        }
        throw new Error(`HTTP ${res.status}: ${detail || res.statusText}`);
    }
    if (res.status === 204) {
        return undefined as unknown as T;
    }
    return res.json() as Promise<T>;
}

export async function listChannels(): Promise<ChannelEntry[]> {
    const res = await fetch(`${API}/admin/channels`, {credentials: 'same-origin'});
    return handle<ChannelEntry[]>(res);
}

export async function putChannelConfig(channelId: string, body: ChannelConfigPayload): Promise<void> {
    const res = await fetch(`${API}/admin/channels/${encodeURIComponent(channelId)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: jsonHeaders,
        body: JSON.stringify(body),
    });
    return handle<void>(res);
}

export async function deleteChannelConfig(channelId: string): Promise<void> {
    const res = await fetch(`${API}/admin/channels/${encodeURIComponent(channelId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: jsonHeaders,
    });
    return handle<void>(res);
}

// Mattermost server APIs used directly from the admin panel for autocomplete.
// These are public, authenticated by the same session cookie.

export interface MMChannel {
    id: string;
    team_id: string;
    name: string;
    display_name: string;
    type: string;
}

export interface MMTeam {
    id: string;
    name: string;
    display_name: string;
}

export interface MMUser {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
}

export async function searchAllChannels(term: string): Promise<MMChannel[]> {
    const res = await fetch('/api/v4/channels/search', {
        method: 'POST',
        credentials: 'same-origin',
        headers: jsonHeaders,
        body: JSON.stringify({term}),
    });
    if (!res.ok) {
        return [];
    }
    return res.json();
}

export async function searchUsers(term: string): Promise<MMUser[]> {
    const res = await fetch('/api/v4/users/search', {
        method: 'POST',
        credentials: 'same-origin',
        headers: jsonHeaders,
        body: JSON.stringify({term, allow_inactive: false, limit: 25}),
    });
    if (!res.ok) {
        return [];
    }
    return res.json();
}
