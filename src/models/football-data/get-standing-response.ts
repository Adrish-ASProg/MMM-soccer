import { Competition } from "./competition";
import { Season } from "./season";
import { Standing } from "./standing";
import { Area } from "./area";

export interface GetStandingResponse {
    area: Area;
    competition: Competition;
    season: Season;
    standings: Standing[];
}
