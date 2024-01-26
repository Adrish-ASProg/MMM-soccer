import { Competition } from "./football-data/competition";
import { Season } from "./football-data/season";
import { Standing } from "./football-data/standing";
import { Team } from "./football-data/team";
import { Match } from "./football-data/match";

export interface LeagueData {
    leagueId: string;

    competition: Competition;
    matches: Match[],
    matchDay: string | number;
    season: Season;
    standings: Standing[];
    teams: Team[]
}
