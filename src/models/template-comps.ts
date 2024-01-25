import { Match } from "./football-data/match";

export interface TemplateComps {
    competition: string;
    season: string;
    matches: Match[];
    emblem?: string;
}
