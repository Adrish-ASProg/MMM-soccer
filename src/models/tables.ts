import { Competition } from "./football-data/competition";
import { Season } from "./football-data/season";
import { Standing } from "./football-data/standing";

export interface Tables {
    competition: Competition;
    season: Season;
    standings: Standing[];
}
