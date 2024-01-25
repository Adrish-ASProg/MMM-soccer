import { Match } from "./football-data/match";

export interface MatchesPerLeague {
    [league: string]: Match[];
}
