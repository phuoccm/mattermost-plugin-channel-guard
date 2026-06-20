// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0
//
// User-facing UX layer (ported from the v1.x vanilla webapp bundle):
// hide the center-channel input + show an explanatory banner in any channel
// where the current user is blocked, intercept submissions client-side as a
// belt-and-suspenders measure, and refresh on the plugin's WebSocket event.

const PLUGIN_ID = 'co.baxu.channel-guard';
const WS_EVENT = `custom_${PLUGIN_ID}_config_changed`;
const STYLE_ID = 'cg-hide-style';
const BANNER_ID = 'cg-banner';

interface Restriction {
    restricted: boolean;
    message?: string;
    fetchedAt?: number;
}

const cache: Record<string, Restriction> = Object.create(null);
const CACHE_TTL_MS = 30 * 1000;

async function fetchRestriction(channelId: string): Promise<Restriction> {
    if (!channelId) {
        return {restricted: false};
    }
    const c = cache[channelId];
    if (c && c.fetchedAt && Date.now() - c.fetchedAt < CACHE_TTL_MS) {
        return c;
    }
    try {
        const res = await fetch(
            `/plugins/${PLUGIN_ID}/api/v1/channels/${encodeURIComponent(channelId)}/restriction`,
            {credentials: 'same-origin', headers: {'X-Requested-With': 'XMLHttpRequest'}},
        );
        if (!res.ok) {
            return {restricted: false};
        }
        const data = await res.json() as Restriction;
        data.fetchedAt = Date.now();
        cache[channelId] = data;
        return data;
    } catch (e) {
        return {restricted: false};
    }
}

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
        '#channel_view #advancedTextEditorCell',
        '#channel_view .AdvancedTextEditor',
        '#channel_view #post-create',
        '.channel__wrap__inner #advancedTextEditorCell',
        '.channel__wrap__inner .AdvancedTextEditor',
        '.channel__wrap__inner #post-create',
    ].join(',') + ' { display: none !important; }';
    document.head.appendChild(style);
}

function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
}

function placeBanner(message: string) {
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
        banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.style.cssText = [
            'margin:8px 16px 16px',
            'padding:14px 18px',
            'border-radius:8px',
            'background:rgba(63,67,80,0.06)',
            'color:rgba(63,67,80,0.85)',
            'font-size:14px',
            'line-height:1.4',
            'text-align:center',
            'border:1px dashed rgba(63,67,80,0.18)',
        ].join(';');
    }
    banner.textContent = '🔒 ' + message;
    const host = document.querySelector('#channel_view') ||
        document.querySelector('.channel__wrap__inner') ||
        document.body;
    if (banner.parentNode !== host) {
        host.appendChild(banner);
    }
}

function removeBanner() {
    document.getElementById(BANNER_ID)?.remove();
}

function applyState(channelId: string) {
    fetchRestriction(channelId).then((state) => {
        if (state.restricted) {
            ensureStyle();
            placeBanner(state.message || 'Only authorized members can start new messages here. You can still reply within existing threads.');
        } else {
            removeStyle();
            removeBanner();
        }
    });
}

function currentChannelId(store: any): string {
    try {
        return store.getState()?.entities?.channels?.currentChannelId || '';
    } catch (e) {
        return '';
    }
}

export function installBanner(registry: any, store: any) {
    let lastChannelId = '';

    function tick() {
        const cid = currentChannelId(store);
        if (cid !== lastChannelId) {
            lastChannelId = cid;
            applyState(cid);
        }
    }

    store.subscribe(tick);
    tick();

    if (registry.registerMessageWillBePostedHook) {
        registry.registerMessageWillBePostedHook(async (post: any) => {
            if (!post || post.root_id) {
                return {post};
            }
            const state = await fetchRestriction(post.channel_id);
            if (state.restricted) {
                return {
                    error: state.message ||
                        'Only authorized members can start new messages in this channel. You can still reply within existing threads.',
                };
            }
            return {post};
        });
    }

    if (registry.registerWebSocketEventHandler) {
        registry.registerWebSocketEventHandler(WS_EVENT, (event: any) => {
            const data = event?.data || {};
            if (data.channel_id) {
                delete cache[data.channel_id];
                if (data.channel_id === currentChannelId(store)) {
                    applyState(data.channel_id);
                }
            }
        });
    }
}
