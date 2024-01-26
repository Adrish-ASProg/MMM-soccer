import axios from "axios";
import moment from "moment/moment";
import * as NodeHelper from "node_helper";
import { GetStandingsResponse } from "./models/football-data/get-standings-response";
import { isFulfilled } from "./utils/utils";
import { Config } from "./models/config";
import { Tables } from "./models/tables";
import { GetMatchesResponse } from "./models/football-data/get-matches-response";
import { LeagueData } from "./models/league-data";

// noinspection JSVoidFunctionReturnValueUsed
module.exports = NodeHelper.create({

    apiKey: "",
    tables: {} as Record<string, Tables>,
    isRunning: false,


    socketNotificationReceived: function(notification, payload) {
        if (notification !== "GET_SOCCER_DATA") return;

        this.config = payload as Config;
        this.leagues = this.config.show;
        this.apiKey = this.config.apiKey;

        this.getTables(this.leagues);
        this.getData(this.config.show);

        if (!this.isRunning) {
            this.isRunning = true;
            this.scheduleAPICalls();
        }
    },

    scheduleAPICalls: function() {
        setInterval(() => {
            this.getTables(this.leagues);
            this.getData(this.config.show);
        }, this.config.apiCallInterval * 1000);
    },

    getData: async function(leagues: string[]) {
        const promises = leagues.map(async league => {
            try {
                return await this.getLeagueData(league);
            } catch (e: any) {
                const status = e?.response?.status;
                const message = e?.response?.data?.message ?? "No error message";
                console.error(`Unable to get data for league "${league}". Status: ${status} - Error: ${message}`);
            }
        });

        const leagueData: LeagueData[] = await Promise.all(promises);
        this.sendSocketNotification("SOCCER_DATA_RETRIEVED", leagueData);
    },

    getLeagueData: async function(league: string) {
        const promises = [
            `https://api.football-data.org/v4/competitions/${league}/standings`,
            `https://api.football-data.org/v4/competitions/${league}/matches`
        ]
            .map(url => axios.get(url, { headers: { "X-Auth-Token": this.apiKey } }));

        const res = await Promise.all(promises);
        const standingsResponse = res[0].data as GetStandingsResponse;
        const matchesResponse = res[1].data as GetMatchesResponse;

        const now = moment();
        const matchDay = matchesResponse.matches
            .map(match => {
                // Cup modes
                if (!match.matchday) {
                    match.matchday = match.stage;
                }

                return {
                    matchDay: match.matchday,
                    diff: Math.abs(now.diff(match.utcDate))
                };
            })
            .toSorted((a, b) => a.diff - b.diff)
            .shift()
            ?.matchDay;

        const teams = standingsResponse.standings
            .flatMap(s => s.table)
            .map(t => t.team);

        return {
            leagueId: standingsResponse.competition.code,
            competition: standingsResponse.competition,
            matches: matchesResponse.matches,
            season: standingsResponse.season,
            standings: standingsResponse.standings,
            matchDay,
            teams
        } as LeagueData;
    },

    getTables: async function(leagues: string[]) {
        const self = this;
        const promises = leagues
            .map(league => `https://api.football-data.org/v4/competitions/${league}/standings`)
            .map(url => axios.get(url, { headers: { "X-Auth-Token": this.apiKey } }));

        const responses = await Promise.allSettled(promises);
        responses
            .filter(isFulfilled)
            .map(res => res.value.data as GetStandingsResponse)
            .forEach(response => {
                self.tables[response.competition.code] = response;
            });

        self.sendSocketNotification("TABLES", self.tables);
    }
});
