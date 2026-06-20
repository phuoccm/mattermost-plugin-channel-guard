// Copyright 2026 baxu
// SPDX-License-Identifier: Apache-2.0

export interface ChannelEntry {
    id: string;
    team_id: string;
    name: string;
    display_name: string;
    type: string; // "O" public, "P" private, "D" direct, "G" group
    enabled: boolean;
    posters: string[];
}

export interface RestrictionResponse {
    restricted: boolean;
    message?: string;
}

export interface ChannelConfigPayload {
    enabled: boolean;
    posters: string[];
}
