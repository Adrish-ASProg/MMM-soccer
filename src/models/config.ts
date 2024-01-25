export type MatchType = "daily" | "league" | "next";
export type ReplaceType = "default" | "short" | "";

export interface Config {
    apiCallInterval: number;
    apiKey: string;
    colored: boolean;
    daysOffset: number;
    debug: boolean;
    fadeFocus: boolean;
    focus_on: Record<string, string>;
    leagues: Record<string, string>;
    logos: boolean;
    matchType: MatchType;
    max_teams: number;
    numberOfNextMatches: number;
    replace: ReplaceType;
    show: string[];
    showMatchDay: boolean;
    showMatches: boolean;
    showTables: boolean;
    updateInterval: number;
    width: number;
}
