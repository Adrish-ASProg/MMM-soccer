import { MatchType } from "./config";

interface DisplayMode {
    matchType: MatchType;
    showMatches: boolean;
    showTables: boolean;
}

export const DISPLAY_MODE: Record<string, DisplayMode> = {
    STANDINGS: {
        matchType: "league",
        showMatches: false,
        showTables: true
    },

    LEAGUE_MATCHES: {
        matchType: "league",
        showMatches: true,
        showTables: false
    },

    NEXT_MATCHES: {
        matchType: "next",
        showMatches: true,
        showTables: false
    },

    DAILY_MATCHES: {
        matchType: "daily",
        showMatches: true,
        showTables: false
    }
};
