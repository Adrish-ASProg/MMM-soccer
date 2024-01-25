import { Team } from "./team";

export interface StandingEntry {
    position: number;
    team: Team;
    playedGames?: number;
    form?: string;
    won: number;
    draw: number;
    lost: number;
    points: number;
    goalsFor?: number;
    goalsAgainst?: number;
    goalDifference?: number;
}
