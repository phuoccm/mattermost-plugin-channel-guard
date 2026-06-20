// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0
//
// Inline CSS-in-JS styles using Mattermost's CSS custom properties so the
// panel inherits the active theme. Avoiding a separate CSS file keeps the
// bundle to a single JS asset.

import type {CSSProperties} from 'react';

const text = 'rgb(var(--center-channel-color-rgb))';
const textMuted = 'rgba(var(--center-channel-color-rgb), 0.72)';
const border = 'rgba(var(--center-channel-color-rgb), 0.16)';
const surface = 'var(--center-channel-bg)';
const primary = 'var(--button-bg)';
const primaryText = 'var(--button-color)';
const danger = '#d24b4e';

export const styles: Record<string, CSSProperties> = {
    panel: {
        padding: '12px 0',
        color: text,
    },
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 16,
    },
    title: {
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: textMuted,
        lineHeight: 1.5,
    },
    primaryBtn: {
        background: primary,
        color: primaryText,
        border: 'none',
        borderRadius: 4,
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        marginRight: 6,
    },
    linkBtn: {
        background: 'transparent',
        color: primary,
        border: 'none',
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        marginRight: 4,
    },
    dangerBtn: {
        background: 'transparent',
        color: danger,
        border: 'none',
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        background: surface,
        border: `1px solid ${border}`,
        borderRadius: 4,
        overflow: 'hidden',
    },
    th: {
        textAlign: 'left',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: textMuted,
        padding: '10px 12px',
        borderBottom: `1px solid ${border}`,
        fontWeight: 600,
    },
    thRight: {
        textAlign: 'right',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: textMuted,
        padding: '10px 12px',
        borderBottom: `1px solid ${border}`,
        fontWeight: 600,
    },
    td: {
        padding: '10px 12px',
        borderBottom: `1px solid ${border}`,
        fontSize: 13,
        verticalAlign: 'top',
    },
    tdRight: {
        padding: '10px 12px',
        borderBottom: `1px solid ${border}`,
        fontSize: 13,
        verticalAlign: 'top',
        textAlign: 'right',
        whiteSpace: 'nowrap',
    },
    channelName: {
        fontWeight: 600,
    },
    muted: {
        fontSize: 12,
        color: textMuted,
    },
    badgeOn: {
        background: 'rgba(36, 158, 102, 0.16)',
        color: '#249e66',
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
    },
    badgeOff: {
        background: 'rgba(var(--center-channel-color-rgb), 0.1)',
        color: textMuted,
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
    },
    chip: {
        display: 'inline-block',
        background: 'rgba(var(--center-channel-color-rgb), 0.08)',
        color: text,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        marginRight: 4,
        marginBottom: 4,
    },
    toggleLabel: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: text,
    },
    textarea: {
        width: '100%',
        background: surface,
        color: text,
        border: `1px solid ${border}`,
        borderRadius: 4,
        padding: 8,
        fontSize: 12,
        fontFamily: 'inherit',
        resize: 'vertical',
    },
    input: {
        width: '100%',
        background: surface,
        color: text,
        border: `1px solid ${border}`,
        borderRadius: 4,
        padding: '8px 10px',
        fontSize: 13,
        marginBottom: 10,
    },
    error: {
        background: 'rgba(210, 75, 78, 0.12)',
        color: danger,
        padding: '8px 12px',
        borderRadius: 4,
        marginBottom: 12,
        fontSize: 12,
    },
    empty: {
        padding: '24px 12px',
        textAlign: 'center',
        color: textMuted,
        fontSize: 13,
        background: 'rgba(var(--center-channel-color-rgb), 0.04)',
        borderRadius: 4,
        border: `1px dashed ${border}`,
    },
    code: {
        fontFamily: 'monospace',
        background: 'rgba(var(--center-channel-color-rgb), 0.08)',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: 12,
    },
    addPanel: {
        marginTop: 16,
        padding: 12,
        border: `1px solid ${border}`,
        borderRadius: 4,
        background: 'rgba(var(--center-channel-color-rgb), 0.03)',
    },
    searchList: {
        listStyle: 'none',
        margin: 0,
        padding: 0,
        maxHeight: 300,
        overflowY: 'auto',
        border: `1px solid ${border}`,
        borderRadius: 4,
    },
    searchRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: `1px solid ${border}`,
        fontSize: 13,
    },
};
