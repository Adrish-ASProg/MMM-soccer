import { StandingEntry } from "./football-data/standing-entry";

export interface StandingView {
    focusTeam?: string;
    standings: StandingEntry[]
}
