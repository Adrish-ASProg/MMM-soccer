import axios from "axios";
import * as NodeHelper from "node_helper";
import { GetStandingResponse } from "./models/football-data/get-standing-response";
import { isFulfilled } from "./utils/utils";
import { Team } from "./models/football-data/team";
import { Config } from "./models/config";
import { Tables } from "./models/tables";
import { GetMatchesResponse } from "./models/football-data/get-matches-response";
import { MatchesPerLeague } from "./models/matches-per-league";

// noinspection JSVoidFunctionReturnValueUsed
module.exports = NodeHelper.create({

    matches: {} as MatchesPerLeague,
    tables: {} as Record<string, Tables>,
    teams: {} as Record<string, Team>,
    isRunning: false,

    start: function() {
        console.log(`Starting module: ${this.name}`);
    },


    socketNotificationReceived: function(notification, payload) {
        if (notification === "GET_SOCCER_DATA") {
            this.config = payload as Config;
            this.leagues = this.config.show;
            this.headers = this.config.apiKey ? { "X-Auth-Token": this.config.apiKey } : {};
            this.getTables(this.leagues);
            this.getMatches(this.leagues);
            if (!this.isRunning) {
                this.isRunning = true;
                this.scheduleAPICalls(false);
            }
        }
    },

    scheduleAPICalls: function() {
        const self = this;

        setInterval(() => {
            self.getTables(self.leagues);
            self.getMatches(self.leagues);
            //self.getMatchDetails(self.liveMatches);
        }, this.config.apiCallInterval * 1000);
    },

    getTables: async function(leagues: string[]) {
        const self = this;
        const promises = leagues
            .map(league => `https://api.football-data.org/v4/competitions/${league}/standings`)
            .map(url => axios.get(url, { headers: self.headers }));

        const responses = await Promise.allSettled(promises);
        responses
            .filter(isFulfilled)
            .map(res => res.value.data as GetStandingResponse)
            .forEach(response => {
                response.standings
                    .flatMap(standing => standing.table)
                    .forEach(ranking => {
                        self.teams[ranking.team.id] = ranking.team;
                    });

                self.tables[response.competition.code] = response;
            });

        self.sendSocketNotification("TABLES", self.tables);
        self.sendSocketNotification("TEAMS", self.teams);
    },

    getMatches: async function(leagues: string[]) {
        const promises = leagues
            .map(league => `https://api.football-data.org/v4/competitions/${league}/matches`)
            .map(url => axios.get(url, { headers: this.headers }));

        const responses = await Promise.allSettled(promises);
        this.matches = responses
            .filter(isFulfilled)
            .map(res => res.value.data as GetMatchesResponse)
            .filter(matchesResponse => matchesResponse.hasOwnProperty("competition"))
            .map(matchesResponse => ({ [matchesResponse.competition.code]: matchesResponse.matches }))
            .reduce((acc, obj) => Object.assign(acc, obj), {});

        this.sendSocketNotification("MATCHES", this.matches);
    },

    log: function(msg: any) {
        if (this.config?.debug) {
            console.log(this.name + ":", JSON.stringify(msg));
        }
    }
});
