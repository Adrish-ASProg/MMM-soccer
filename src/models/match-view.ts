import { Match } from "./football-data/match";

export interface MatchView {
    matchDayLabel: string;
    matches: Match[];
    competition?: string;
    matchDay?: string;
    emblem?: string;
}
