import { Config } from "../models/config";
import { LeagueData } from "../models/league-data";
import { Standing } from "../models/football-data/standing";
import { StandingEntry } from "../models/football-data/standing-entry";
import { StandingView } from "../models/standing-view";

export const buildStandingsView = (leagueDatas: LeagueData[], currentCompetition: string, config: Config): StandingView => {
    if (!leagueDatas.length) return { standings: [] };

    const focus: string = config.focus_on?.[currentCompetition];
    const standings = filterTables(leagueDatas, currentCompetition, focus);

    if (!config.max_teams) return { standings };

    if (!focus || focus === "TOP") {
        return { standings: standings.slice(0, Math.min(config.max_teams, standings.length)) };
    }

    if (focus === "BOTTOM") {
        return { standings: standings.slice(Math.max(standings.length - config.max_teams, 0), standings.length) };
    }

    // Focus on team
    const focusedIndex = standings.indexOf(standings.find((s: StandingEntry) => s.team.name === focus)!);

    let startIndex = Math.max(0, focusedIndex - Math.floor(config.max_teams / 2));
    const endIndex = Math.min(standings.length - 1, startIndex + config.max_teams - 1);
    startIndex = Math.max(0, endIndex - config.max_teams + 1);

    return {
        focusTeam: focus,
        standings: standings.slice(startIndex, endIndex + 1)
    };
};


function filterTables(leagueDatas: LeagueData[], currentCompetition: string, focus?: string): StandingEntry[] {
    const standings: Standing[] = leagueDatas
            .find((data: LeagueData) => data.competition.code === currentCompetition)
            ?.standings
            ?.filter((standing: Standing) => standing.type === "TOTAL")
        ?? [];

    // Cups, only return the group containing the focused team if any
    if (standings.length > 1 && focus && !["TOP", "BOTTOM"].includes(focus)) {
        return standings
                .map((standing: Standing) => standing.table)
                .find((standingEntries: StandingEntry[]) => standingEntries.some(entry => entry.team.name === focus))
            ?? [];
    }

    return standings[0].table;
}
