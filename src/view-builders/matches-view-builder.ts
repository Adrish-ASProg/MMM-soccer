import dayjs from "dayjs";
import { LeagueData } from "../models/league-data";
import { Match } from "../models/football-data/match";
import { Config, MatchType } from "../models/config";
import { MatchView } from "../models/match-view";

export const buildMatchViews = (leagueDatas: LeagueData[], currentCompetition: string, config: Config): MatchView[] => {
    if (!leagueDatas.length) {
        return [{ matchDayLabel: "LOADING", matches: [] }];
    }

    const focusTeam = config.focus_on[currentCompetition];

    switch (config.matchType) {
        case "league":
            return buildLeagueMatchView(leagueDatas, currentCompetition, focusTeam);

        case "next":
            return buildNextMatchView(leagueDatas, config.numberOfNextMatches, Object.values(config.focus_on));


        case "daily":
            return buildDailyMatchView(leagueDatas, config.daysOffset, focusTeam);

        default:
            return [];
    }

};

export const buildLeagueMatchView = (leagueDatas: LeagueData[], currentCompetition: string, focusTeam: string): MatchView[] => {
    const leagueData: LeagueData = leagueDatas.find(data => data.competition.code === currentCompetition)!;
    const matches = leagueData.matches.filter(match => match.matchday === leagueData.matchDay);

    const matchView = {
        matchDayLabel: "MATCHDAY",
        matchDay: leagueData.matchDay.toString(),
        competition: leagueData.competition.name,
        emblem: leagueData.competition.emblem,
        matches
    };

    return processMatches([matchView], "league", focusTeam);
};

export const buildNextMatchView = (leagueDatas: LeagueData[], nextMatchesCount: number, focusedTeams: string[]) => {
    const focusedTeamsMatches = leagueDatas
        .flatMap((leagueData: LeagueData) => leagueData.matches)
        .filter((match: Match) => focusedTeams.includes(match.homeTeam.name) || focusedTeams.includes(match.awayTeam.name))
        .filter((match: Match) => !dayjs(match.utcDate).isBefore())
        .toSorted((match1: Match, match2: Match) => dayjs(match1.utcDate).diff(dayjs(match2.utcDate)))
        .slice(0, nextMatchesCount);

    const matchView = {
        competition: "",
        matchDayLabel: "NEXT_MATCHES",
        matches: focusedTeamsMatches
    };

    return processMatches([matchView], "next");
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
