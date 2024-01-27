import { MatchView } from "./models/match-view";
import { Match } from "./models/football-data/match";
import moment from "moment/moment";
import { LeagueData } from "./models/league-data";
import { MatchType } from "./models/config";

export const ViewBuilder = {
    toLeagueMatchView: (leagueData: LeagueData, matchDayLabel: string, focusTeam: string) => {
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
    },
    toNextMatchView: (leagueDatas: LeagueData[], nextMatchesCount: number, matchDayLabel: string, focusedTeams: string[]) => {
        const focusedTeamsMatches = leagueDatas
            .flatMap((leagueData: LeagueData) => leagueData.matches)
            .filter((match: Match) => focusedTeams.includes(match.homeTeam.name) || focusedTeams.includes(match.awayTeam.name))
            .filter((match: Match) => !moment(match.utcDate).isBefore())
            .toSorted((match1: Match, match2: Match) => moment(match1.utcDate).diff(moment(match2.utcDate)))
            .slice(0, nextMatchesCount);

        const matchViews = {
            competition: "",
            matchDayLabel,
            matches: focusedTeamsMatches
        };

        return processMatches([matchViews], "next");
    },
    toDailyMatchView: (leagueDatas: LeagueData[], daysOffset: number, focusTeam: string) => {
        const today = moment().subtract(daysOffset, "days");

        const matchViews = leagueDatas.map((leagueData: LeagueData) => ({
            competition: leagueData.competition.name,
            matchDayLabel: "",
            matches: leagueData.matches.filter(match => moment(match.utcDate).isSame(today, "day"))
        }));

        return processMatches(matchViews, "daily", focusTeam);
    },
}

function processMatches(matchViews: MatchView[], matchType: MatchType, focusTeam: string = "") {
    matchViews.forEach(matchView => {
        matchView.matches.forEach((match: Match) => {
            if (matchType === "league" || matchType === "daily") {
                match.focused = [match.homeTeam.name, match.awayTeam.name].includes(focusTeam);
            }

            if (match.status === "TIMED" || match.status === "SCHEDULED" || match.status === "POSTPONED") {
                match.state = (moment(match.utcDate).diff(moment(), "days") > 7) ? moment(match.utcDate).format("D.MM.") : (moment(match.utcDate).startOf("day") > moment()) ? moment(match.utcDate).format("dd HH:mm") : moment(match.utcDate).format("LT");
            } else {
                match.state = match.score.fullTime.home + " - " + match.score.fullTime.away;
                if (match.score.winner === "HOME_TEAM") {
                    match.homeTeam["status"] = "winner";
                } else if (match.score.winner === "AWAY_TEAM") {
                    match.awayTeam["status"] = "winner";
                }
            }
        });
    });

    return matchViews;
}
