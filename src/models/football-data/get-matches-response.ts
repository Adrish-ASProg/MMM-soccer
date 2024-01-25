import { Competition } from "./competition";
import { Match } from "./match";

export interface GetMatchesResponse {
    competition: Competition;
    matches: Match[];
}
