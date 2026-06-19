/* Copyright 2026 baxu
 * SPDX-License-Identifier: Apache-2.0
 *
 * Channel Guard — webapp side.
 *
 * Three layers of UX so a blocked user never sees the generic "Retry/Cancel"
 * modal that Mattermost shows when the server rejects a post:
 *   1. Channel observer: when the user navigates into a restricted channel,
 *      hide the center-channel input and show an explanatory banner.
 *   2. MessageWillBePostedHook: belt-and-suspenders client-side block, in case
 *      the CSS hide hasn't kicked in yet (just-loaded page, race).
 *   3. WebSocket listener: when an admin enables/disables/edits the allow list,
 *      every connected client refreshes its state without a page reload.
 *
 * The server-side MessageWillBePosted hook is still the source of truth —
 * everything here is purely UX.
 */
(function () {
    var PLUGIN_ID = 'co.baxu.channel-guard';
    var WS_EVENT = 'custom_' + PLUGIN_ID + '_config_changed';
    var STYLE_ID = 'cg-hide-style';
    var BANNER_ID = 'cg-banner';

    // Cache: channelId -> {restricted, message, fetchedAt}
    var cache = Object.create(null);
    var CACHE_TTL_MS = 30 * 1000;

    function fetchRestriction(channelId) {
        if (!channelId) {
            return Promise.resolve({restricted: false});
        }
        var cached = cache[channelId];
        if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
            return Promise.resolve(cached);
        }
        return fetch('/plugins/' + PLUGIN_ID + '/api/v1/channels/' + encodeURIComponent(channelId) + '/restriction', {
            credentials: 'same-origin',
            headers: {'X-Requested-With': 'XMLHttpRequest'},
        }).then(function (res) {
            if (!res.ok) {
                return {restricted: false};
            }
            return res.json();
        }).then(function (data) {
            data.fetchedAt = Date.now();
            cache[channelId] = data;
            return data;
        }).catch(function () {
            return {restricted: false};
        });
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }
        var style = document.createElement('style');
        style.id = STYLE_ID;
        // Hide only the CENTER channel post creator, not the thread reply (right sidebar).
        // Mattermost's DOM evolves; cover legacy + current selectors.
        style.textContent =
            '#channel_view #advancedTextEditorCell,' +
            '#channel_view .AdvancedTextEditor,' +
            '#channel_view #post-create,' +
            '.channel__wrap__inner #advancedTextEditorCell,' +
            '.channel__wrap__inner .AdvancedTextEditor,' +
            '.channel__wrap__inner #post-create' +
            ' { display: none !important; }';
        document.head.appendChild(style);
    }

    function removeStyle() {
        var el = document.getElementById(STYLE_ID);
        if (el) el.parentNode.removeChild(el);
    }

    function placeBanner(message) {
        var banner = document.getElementById(BANNER_ID);
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
        // Try to place it where the input used to be.
        var host =
            document.querySelector('#channel_view') ||
            document.querySelector('.channel__wrap__inner') ||
            document.body;
        if (banner.parentNode !== host) {
            host.appendChild(banner);
        }
    }

    function removeBanner() {
        var el = document.getElementById(BANNER_ID);
        if (el) el.parentNode.removeChild(el);
    }

    function applyState(channelId) {
        fetchRestriction(channelId).then(function (state) {
            if (state.restricted) {
                ensureStyle();
                placeBanner(state.message || 'Only authorized members can start new messages here. You can still reply within existing threads.');
            } else {
                removeStyle();
                removeBanner();
            }
        });
    }

    function currentChannelId(store) {
        try {
            var s = store.getState();
            return s && s.entities && s.entities.channels && s.entities.channels.currentChannelId;
        } catch (e) {
            return '';
        }
    }

    function init(registry, store) {
        var lastChannelId = '';

        function tick() {
            var cid = currentChannelId(store);
            if (cid !== lastChannelId) {
                lastChannelId = cid;
                applyState(cid);
            }
        }

        store.subscribe(tick);
        tick();

        // Belt-and-suspenders: also intercept submissions client-side so the user
        // sees an inline error instead of the generic "Retry/Cancel" modal in the
        // rare case the input wasn't hidden yet.
        if (registry.registerMessageWillBePostedHook) {
            registry.registerMessageWillBePostedHook(function (post) {
                if (!post || post.root_id) {
                    return Promise.resolve({post: post});
                }
                return fetchRestriction(post.channel_id).then(function (state) {
                    if (state.restricted) {
                        return {
                            error: state.message || 'Only authorized members can start new messages in this channel. You can still reply within existing threads.',
                        };
                    }
                    return {post: post};
                });
            });
        }

        // Refresh immediately when an admin changes config (no page reload needed).
        if (registry.registerWebSocketEventHandler) {
            registry.registerWebSocketEventHandler(WS_EVENT, function (event) {
                var data = (event && event.data) || {};
                if (data.channel_id) {
                    delete cache[data.channel_id];
                    if (data.channel_id === currentChannelId(store)) {
                        applyState(data.channel_id);
                    }
                }
            });
        }
    }

    if (window.registerPlugin) {
        window.registerPlugin(PLUGIN_ID, {initialize: init});
    }
})();
