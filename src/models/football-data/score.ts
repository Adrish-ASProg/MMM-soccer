export interface Score {
    winner: "AWAY_TEAM" | "HOME_TEAM" | "DRAW",
    duration: string,
    fullTime: {
        home: number,
        away: number
    },
    halfTime: {
        home: number,
        away: number
    }
}
