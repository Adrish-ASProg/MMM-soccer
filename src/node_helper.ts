/**
 * @file node_helper.js
 *
 * @author lavolp3 / fewieden (original module)
 * @license MIT
 *
 * @see  https://github.com/lavolp3/MMM-soccer
 */

/* jshint esversion: 6 */

const axios = require("axios");
const NodeHelper = require("node_helper");
const moment = require("moment");

module.exports = NodeHelper.create({

    matches: {},
    tables: {},
    teams: {},
    teamList: {},
    liveMatches: [],
    liveLeagues: [],
    isRunning: false,
    callInterval: undefined,

    start: function() {
        console.log(`Starting module: ${this.name}`);
    },


    socketNotificationReceived: function(notification, payload) {
        if (notification === "GET_SOCCER_DATA") {
            this.config = payload;
            this.leagues = this.config.show;
            this.headers = payload.api_key ? { "X-Auth-Token": payload.api_key } : {};
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

    getTables: function(leagues) {
        const self = this;
        const urlArray = leagues.map(league => `https://api.football-data.org/v4/competitions/${league}/standings`);

        Promise.all(urlArray.map(url => {
            return axios.get(url, { headers: self.headers })
                .then(response => ({
                    competition: response.data.competition,
                    season: response.data.season,
                    standings: response.data.standings
                }))
                .catch(error => {
                    self.handleErrors(error, url);
                    return {};
                });
        }))
            .then(tableArray => {
                tableArray
                    .filter(tables => tables.hasOwnProperty("standings"))
                    .forEach(tables => {
                        tables.standings
                            .flatMap(standing => standing.table)
                            .forEach(ranking => {
                                self.teams[ranking.team.id] = ranking.team;
                                self.teamList[ranking.team.name] = ranking.team.name;
                            });

                        self.tables[tables.competition.code] = tables;
                    });

                self.sendSocketNotification("TABLES", self.tables);
                self.sendSocketNotification("TEAMS", self.teams);
            });
    },

    getMatches: function(leagues) {
        const now = moment().subtract(60 * 13, "minutes");	//subtract minutes or hours to test live mode
        const urlArray = leagues.map(league => `https://api.football-data.org/v4/competitions/${league}/matches`);
        this.liveLeagues = [];
        const self = this;
        Promise.all(urlArray.map(url => {
            return axios.get(url, { headers: self.headers })
                .then(response => {
                    const matchesData = response.data;
                    const currentLeague = matchesData.competition.code;
                    matchesData.matches.forEach(match => {
                        delete match.referees;

                        //check for live matches
                        if (match.status === "IN_PLAY" || Math.abs(moment(match.utcDate).diff(now, "seconds")) < self.config.apiCallInterval * 2) {
                            if (self.liveMatches.indexOf(match.id) === -1) {
                                self.log(`Live match detected starting at ${moment(match.utcDate).format("HH:mm")}, Home Team: ${match.homeTeam.name}`);
                                self.log(`Live match ${match.id} added at ${moment().format("HH:mm")}`);
                                self.liveMatches.push(match.id);
                            }
                            if (self.liveLeagues.indexOf(currentLeague) === -1) {
                                self.log(`Live league ${currentLeague} added at ${moment().format("HH:mm")}`);
                                self.liveLeagues.push(currentLeague);
                            }
                        } else {
                            if (self.liveMatches.indexOf(match.id) !== -1) {
                                self.log("Live match finished!");
                                self.liveMatches.splice(self.liveMatches.indexOf(match.id), 1);
                            }
                        }
                    });
                    return (matchesData);
                })
                .catch(error => {
                    self.handleErrors(error, url);
                    return {};
                });
        }))
            .then(matchesArray => {
                matchesArray
                    .filter(comp => comp.hasOwnProperty("competition"))
                    .forEach(comp => {
                        self.matches[comp.competition.code] = comp;
                    });
                self.sendSocketNotification("MATCHES", self.matches);
                self.toggleLiveMode(self.liveMatches.length > 0);
            })
            .catch(error => {
                console.error("[MMM-soccer] ERROR occurred while fetching matches: " + error);
            });
    },

    handleErrors: function(error, url) {
        console.error(`GET ${url} error:`, error);

        if (error.response && error.response.status === 429) {
            console.error(`${error.response.status}: API Request Quota exceeded, try selecting fewer leagues.`);
        }
    },

    toggleLiveMode: function(isLive) {
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

    log: function(msg) {
        if (this.config?.debug) {
            console.log(this.name + ":", JSON.stringify(msg));
        }
    }
});
