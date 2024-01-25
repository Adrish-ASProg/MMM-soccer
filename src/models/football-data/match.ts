import { Score } from "./score";
import { Team } from "./team";

export interface Match {
    id: number,
    utcDate: string,
    status: string,
    homeTeam: Team;
    awayTeam: Team;
    score: Score;
    matchday?: number | string,
    stage?: string,
    lastUpdated?: string,
    group?: any,
    referees?: any[];
    focused?: boolean;
    state?: string;
}
