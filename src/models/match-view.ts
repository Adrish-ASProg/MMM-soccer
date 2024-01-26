import { Match } from "./football-data/match";

export interface MatchView {
    competition: string;
    matchDayLabel: string;
    matches: Match[];
    emblem?: string;
}
