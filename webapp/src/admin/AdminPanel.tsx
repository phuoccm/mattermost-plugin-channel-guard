// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0
//
// AdminPanel — System Console custom setting that lists every channel where
// Channel Guard is configured and lets a System Admin enable/disable it,
// edit the per-channel allow list, or remove the entry entirely.
//
// All state changes go through the plugin's own admin HTTP API; the server-side
// MessageWillBePosted hook is the authoritative source of truth for posts.

import React, {useEffect, useState, useCallback} from 'react';

import {
    listChannels,
    putChannelConfig,
    deleteChannelConfig,
    searchAllChannels,
    type MMChannel,
} from './api';
import type {ChannelEntry} from './types';
import {styles} from './styles';

interface Props {
    // The Mattermost custom-setting React component receives a few props but
    // none of them are strictly needed for this panel; declared loose for
    // future-proofing against API changes.
    id?: string;
    label?: string;
    helpText?: React.ReactNode;
    value?: unknown;
    disabled?: boolean;
    setSaveNeeded?: () => void;
    onChange?: (key: string, value: unknown) => void;
}

type EditState = {channelId: string; posters: string; enabled: boolean} | null;

const channelTypeLabel = (t: string) => {
    switch (t) {
        case 'O': return 'Public';
        case 'P': return 'Private';
        case 'D': return 'Direct';
        case 'G': return 'Group';
        default: return t;
    }
};

const ChannelsManager: React.FC<Props> = () => {
    const [rows, setRows] = useState<ChannelEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [edit, setEdit] = useState<EditState>(null);
    const [adding, setAdding] = useState<boolean>(false);
    const [search, setSearch] = useState<string>('');
    const [searchResults, setSearchResults] = useState<MMChannel[]>([]);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await listChannels();
            setRows(data || []);
        } catch (e) {
            setError((e as Error).message || 'Failed to load channels');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const beginEdit = (row: ChannelEntry) => {
        setEdit({
            channelId: row.id,
            posters: row.posters.join(', '),
            enabled: row.enabled,
        });
    };

    const cancelEdit = () => setEdit(null);

    const saveEdit = async () => {
        if (!edit) {
            return;
        }
        const posters = edit.posters
            .split(/[\s,]+/)
            .map((s) => s.trim().replace(/^@/, '').toLowerCase())
            .filter(Boolean);
        try {
            await putChannelConfig(edit.channelId, {enabled: edit.enabled, posters});
            setEdit(null);
            refresh();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const toggleEnabled = async (row: ChannelEntry) => {
        try {
            await putChannelConfig(row.id, {enabled: !row.enabled, posters: row.posters});
            refresh();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const remove = async (row: ChannelEntry) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Remove Channel Guard from "${row.display_name || row.name}"? Posts will no longer be restricted.`)) {
            return;
        }
        try {
            await deleteChannelConfig(row.id);
            refresh();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const runSearch = async (term: string) => {
        setSearch(term);
        if (term.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const out = await searchAllChannels(term.trim());
            // Filter out channels already configured.
            const existing = new Set(rows.map((r) => r.id));
            setSearchResults(out.filter((c) => !existing.has(c.id)));
        } catch (e) {
            setSearchResults([]);
        }
    };

    const addChannel = async (channel: MMChannel) => {
        try {
            await putChannelConfig(channel.id, {enabled: true, posters: []});
            setAdding(false);
            setSearch('');
            setSearchResults([]);
            refresh();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    return (
        <div style={styles.panel}>
            <div style={styles.header}>
                <div>
                    <div style={styles.title}>Per-channel allow lists</div>
                    <div style={styles.subtitle}>
                        Channels where Channel Guard is configured. Each row controls who can start new
                        messages in that channel. Replies inside threads are always allowed.
                    </div>
                </div>
                <button
                    type="button"
                    style={styles.primaryBtn}
                    onClick={() => setAdding(true)}
                >
                    {'+ Add channel'}
                </button>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {loading && <div style={styles.muted}>{'Loading…'}</div>}

            {!loading && rows.length === 0 && !adding && (
                <div style={styles.empty}>
                    No channels are configured yet. Click <strong>Add channel</strong> to start, or run
                    <code style={styles.code}>{' /channel-guard enable '}</code> from inside any channel.
                </div>
            )}

            {!loading && rows.length > 0 && (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Channel</th>
                            <th style={styles.th}>Type</th>
                            <th style={styles.th}>Status</th>
                            <th style={styles.th}>Allowed posters</th>
                            <th style={styles.thRight}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const isEditing = edit?.channelId === row.id;
                            return (
                                <tr key={row.id}>
                                    <td style={styles.td}>
                                        <div style={styles.channelName}>
                                            {row.display_name || row.name || row.id}
                                        </div>
                                        <div style={styles.muted}>{row.id}</div>
                                    </td>
                                    <td style={styles.td}>{channelTypeLabel(row.type)}</td>
                                    <td style={styles.td}>
                                        {isEditing ? (
                                            <label style={styles.toggleLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={edit!.enabled}
                                                    onChange={(e) => setEdit({...edit!, enabled: e.target.checked})}
                                                />
                                                {' Enabled'}
                                            </label>
                                        ) : (
                                            <span style={row.enabled ? styles.badgeOn : styles.badgeOff}>
                                                {row.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        )}
                                    </td>
                                    <td style={styles.td}>
                                        {isEditing ? (
                                            <textarea
                                                style={styles.textarea}
                                                rows={3}
                                                value={edit!.posters}
                                                placeholder="@alice, @bob"
                                                onChange={(e) => setEdit({...edit!, posters: e.target.value})}
                                            />
                                        ) : row.posters.length === 0 ? (
                                            <span style={styles.muted}>{'(none)'}</span>
                                        ) : (
                                            row.posters.map((p) => (
                                                <span key={p} style={styles.chip}>{`@${p}`}</span>
                                            ))
                                        )}
                                    </td>
                                    <td style={styles.tdRight}>
                                        {isEditing ? (
                                            <>
                                                <button type="button" style={styles.primaryBtn} onClick={saveEdit}>{'Save'}</button>
                                                <button type="button" style={styles.linkBtn} onClick={cancelEdit}>{'Cancel'}</button>
                                            </>
                                        ) : (
                                            <>
                                                <button type="button" style={styles.linkBtn} onClick={() => beginEdit(row)}>{'Edit'}</button>
                                                <button type="button" style={styles.linkBtn} onClick={() => toggleEnabled(row)}>
                                                    {row.enabled ? 'Disable' : 'Enable'}
                                                </button>
                                                <button type="button" style={styles.dangerBtn} onClick={() => remove(row)}>{'Remove'}</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            {adding && (
                <div style={styles.addPanel}>
                    <div style={styles.title}>{'Add a channel to Channel Guard'}</div>
                    <input
                        type="text"
                        style={styles.input}
                        placeholder="Type at least 2 characters to search channels…"
                        value={search}
                        onChange={(e) => runSearch(e.target.value)}
                        autoFocus={true}
                    />
                    {search.trim().length >= 2 && searchResults.length === 0 && (
                        <div style={styles.muted}>{'No matching channels (or all matches are already configured).'}</div>
                    )}
                    {searchResults.length > 0 && (
                        <ul style={styles.searchList}>
                            {searchResults.map((c) => (
                                <li key={c.id} style={styles.searchRow}>
                                    <span>
                                        <strong>{c.display_name || c.name}</strong>{' '}
                                        <span style={styles.muted}>{`(${channelTypeLabel(c.type)})`}</span>
                                    </span>
                                    <button type="button" style={styles.primaryBtn} onClick={() => addChannel(c)}>{'Add'}</button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div style={{marginTop: 12}}>
                        <button
                            type="button"
                            style={styles.linkBtn}
                            onClick={() => {
                                setAdding(false);
                                setSearch('');
                                setSearchResults([]);
                            }}
                        >{'Close'}</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChannelsManager;
