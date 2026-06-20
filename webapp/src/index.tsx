// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

import React from 'react';

import {installBanner} from './banner';
import AdminPanel from './admin/AdminPanel';

const PLUGIN_ID = 'co.baxu.channel-guard';

declare global {
    interface Window {
        registerPlugin: (id: string, plugin: {initialize: (registry: any, store: any) => void}) => void;
    }
}

class ChannelGuardPlugin {
    initialize(registry: any, store: any) {
        installBanner(registry, store);

        // Register the System Console panel for managing per-channel allow lists.
        // The key "ChannelsManager" matches the entry in plugin.json with type: "custom".
        if (typeof registry.registerAdminConsoleCustomSetting === 'function') {
            registry.registerAdminConsoleCustomSetting(
                'ChannelsManager',
                AdminPanel,
                {showTitle: false},
            );
        }
    }
}

window.registerPlugin(PLUGIN_ID, new ChannelGuardPlugin());

// Suppress "React not used" linter when JSX is classic-transformed.
export {React};
