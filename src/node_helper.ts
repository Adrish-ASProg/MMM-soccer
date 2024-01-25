import axios from "axios";
import * as NodeHelper from "node_helper";
import moment from "moment";
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
    liveMatches: [] as number[],
    liveLeagues: [] as string[],
    isRunning: false,
    callInterval: undefined,

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
                this.liveMode = false;
                this.isRunning = true;
                this.scheduleAPICalls(false);
            }
        }
    },

    scheduleAPICalls: function() {
        const self = this;
        const updateInterval = (this.liveLeagues.length > 0) ? 60 * 1000 : this.config.apiCallInterval * 1000;

        this.callInterval = setInterval(() => {
            self.getTables(self.leagues);
            self.getMatches(self.leagues);
            //self.getMatchDetails(self.liveMatches);
        }, updateInterval);
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
        this.liveLeagues = [];
        const promises = leagues
            .map(league => `https://api.football-data.org/v4/competitions/${league}/matches`)
            .map(url => axios.get(url, { headers: this.headers }));

        const responses = await Promise.allSettled(promises);
        this.matches = responses
            .filter(isFulfilled)
            .map(res => res.value.data as GetMatchesResponse)
            .map(matchesResponse => this.handleLiveMatches(matchesResponse))
            .filter(matchesResponse => matchesResponse.hasOwnProperty("competition"))
            .map(matchesResponse => ([matchesResponse.competition.code, matchesResponse.matches]))
            .map(([competition, matches]) => ({ [competition]: matches }))
            .reduce((acc, obj) => Object.assign(acc, obj), {});

        this.sendSocketNotification("MATCHES", this.matches);
        this.toggleLiveMode(this.liveMatches.length > 0);
    },

    handleLiveMatches: function(matchesData: GetMatchesResponse) {
        const now = moment().subtract(60 * 13, "minutes");	//subtract minutes or hours to test live mode

        const currentLeague = matchesData.competition.code;
        matchesData.matches.forEach(match => {
            delete match.referees;

            // check for live matches
            if (match.status === "IN_PLAY" || Math.abs(moment(match.utcDate).diff(now, "seconds")) < this.config.apiCallInterval * 2) {
                if (!this.liveMatches.includes(match.id)) {
                    this.log(`Live match detected starting at ${moment(match.utcDate).format("HH:mm")}, Home Team: ${match.homeTeam.name}`);
                    this.log(`Live match ${match.id} added at ${moment().format("HH:mm")}`);
                    this.liveMatches.push(match.id);
                }

                if (!this.liveLeagues.includes(currentLeague)) {
                    this.log(`Live league ${currentLeague} added at ${moment().format("HH:mm")}`);
                    this.liveLeagues.push(currentLeague);
                }
            } else {
                if (this.liveMatches.includes(match.id)) {
                    this.log("Live match finished!");
                    this.liveMatches.splice(this.liveMatches.indexOf(match.id), 1);
                }
            }
        });

        return matchesData;
    },

    toggleLiveMode: function(isLive: boolean) {
        if (isLive !== this.liveMode) {
            if (this.callInterval) clearInterval(this.callInterval);
            if (isLive) {
                this.log("Live Mode activated!");
                //this.leagues = this.liveLeagues;
                this.sendSocketNotification("LIVE", {
                    live: true,
                    matches: this.liveMatches,
                    leagues: this.liveLeagues
                });
                this.scheduleAPICalls(true);
            } else {
                this.log("Usual mode active!");
                //this.leagues = this.config.show;
                this.sendSocketNotification("LIVE", {
                    live: false,
                    matches: this.liveMatches,
                    leagues: this.liveLeagues
                });
                this.scheduleAPICalls(false);
            }
            this.liveMode = isLive;
        }
    },

    log: function(msg: any) {
        if (this.config?.debug) {
            console.log(this.name + ":", JSON.stringify(msg));
        }
    }
});
