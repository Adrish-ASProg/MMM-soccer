import dayjs from "dayjs";
import { LeagueData } from "../models/league-data";
import { Match } from "../models/football-data/match";
import { MatchType } from "../models/config";
import { MatchView } from "../models/match-view";

export const buildLeagueMatchView = (leagueData: LeagueData, matchDayLabel: string, focusTeam: string) => {
    const matches = leagueData.matches
        .filter((match: Match) => match.matchday === leagueData.matchDay)
        .filter((match: Match) => match.matchday === leagueData.matchDay);

    const matchViews = {
        matchDayLabel,
        competition: leagueData.competition.name,
        emblem: leagueData.competition.emblem,
        matches
    };

    return processMatches([matchViews], "league", focusTeam);
};

export const buildNextMatchView = (leagueDatas: LeagueData[], nextMatchesCount: number, matchDayLabel: string, focusedTeams: string[]) => {
    const focusedTeamsMatches = leagueDatas
        .flatMap((leagueData: LeagueData) => leagueData.matches)
        .filter((match: Match) => focusedTeams.includes(match.homeTeam.name) || focusedTeams.includes(match.awayTeam.name))
        .filter((match: Match) => !dayjs(match.utcDate).isBefore())
        .toSorted((match1: Match, match2: Match) => dayjs(match1.utcDate).diff(dayjs(match2.utcDate)))
        .slice(0, nextMatchesCount);

    const matchViews = {
        competition: "",
        matchDayLabel,
        matches: focusedTeamsMatches
    };

    return processMatches([matchViews], "next");
};

export const buildDailyMatchView = (leagueDatas: LeagueData[], daysOffset: number, focusTeam: string) => {
    const today = dayjs().subtract(daysOffset, "days");

    const matchViews = leagueDatas.map((leagueData: LeagueData) => ({
        competition: leagueData.competition.name,
        matchDayLabel: "",
        matches: leagueData.matches.filter(match => dayjs(match.utcDate).isSame(today, "day"))
    }));

    return processMatches(matchViews, "daily", focusTeam);
};

function processMatches(matchViews: MatchView[], matchType: MatchType, focusTeam: string = "") {
    matchViews
        .flatMap(matchView => matchView.matches)
        .forEach((match: Match) => {
            if (matchType === "league" || matchType === "daily") {
                match.focused = [match.homeTeam.name, match.awayTeam.name].includes(focusTeam);
            }

            match.state = buildMatchState(match);
        });

    return matchViews;
}

function buildMatchState(match: Match): string {
    if (!["TIMED", "SCHEDULED", "POSTPONED"].includes(match.status)) {
        return `${match.score.fullTime.home} - ${match.score.fullTime.away}`;
    }

    const now = dayjs();
    const matchDate = dayjs(match.utcDate);
    const remainingDays = matchDate.diff(now, "days");

    return remainingDays > 7
        ? matchDate.format("DD/MM")
        : (matchDate.startOf("day").isAfter())
            ? matchDate.format("dd HH:mm")
            : matchDate.format("HH:mm");
}
