import { Team } from "./team";

export interface Season {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
    winner?: Team;
}
