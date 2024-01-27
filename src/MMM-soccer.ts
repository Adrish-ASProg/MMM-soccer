import Hammer from "hammerjs";
import moment from "moment";
import { Config } from "./models/config";
import { DISPLAY_MODES } from "./models/cycle-mode";
import { Match } from "./models/football-data/match";
import { TemplateData } from "./models/template-data";
import { LeagueData } from "./models/league-data";
import { MatchView } from "./models/match-view";
import { StandingEntry } from "./models/football-data/standing-entry";
import { StandingView } from "./models/standing-view";
import { Standing } from "./models/football-data/standing";

const cycles = [
    DISPLAY_MODES.STANDINGS,
    DISPLAY_MODES.LEAGUE_MATCHES,
    DISPLAY_MODES.NEXT_MATCHES,
    DISPLAY_MODES.DAILY_MATCHES
];

Module.register<Config>("MMM-soccer", {
    defaults: {
        apiKey: "",
        colored: false,
        width: 400,
        show: ["BL1", "CL", "PL"],
        updateInterval: 30,
        apiCallInterval: 10 * 60,
        focus_on: {},
        max_teams: 0,
        logos: true,
        showTables: true,
        showMatches: true,
        matchType: "league",
        numberOfNextMatches: 8,
        leagues: {
            GERMANY: "BL1",
            FRANCE: "FL1",
            ENGLAND: "PL",
            SPAIN: "PD",
            ITALY: "SA"
        },
        replace: "default",
        daysOffset: 0,
        debug: false
    },

    loading: true,
    leagueDatas: [] as LeagueData[],
    showTable: true,
    leagues: [] as string[],
    replacements: {
        default: {}
    },
    competition: "",
    competitionIndex: 0,
    refreshTimer: undefined,
    currentCycle: 0,

    start: function() {
        this.addFilters();
        this.leagues = this.config.show;
        this.competition = this.leagues[0];
        this.showTable = this.config.showTables;
        const self = this;
        this.loadReplacements((response: string) => {
            self.replacements = JSON.parse(response);
        });
        this.sendSocketNotification("GET_SOCCER_DATA", this.config);
        this.scheduleDOMUpdates();
    },

    getScripts: function() {
        return [this.file("node_modules/hammerjs/hammer.js")];
    },

    setupGestures() {
        const hammer = new Hammer.Manager(document.getElementById(this.identifier)!);
        hammer.add(new Hammer.Tap({ taps: 2 }));
        hammer.add(new Hammer.Swipe());

        hammer.on("swiperight", this.showPreviousCycle.bind(this));
        hammer.on("swipeleft", this.showNextCycle.bind(this));
        hammer.on("tap", this.showNextLeague.bind(this));
    },

    showPreviousCycle() {
        this.currentCycle = this.currentCycle === 0 ? cycles.length - 1 : this.currentCycle - 1;
        this.updateCurrentCycle();
    },

    showNextCycle() {
        this.currentCycle = this.currentCycle >= cycles.length - 1 ? 0 : this.currentCycle + 1;
        this.updateCurrentCycle();
    },

    updateCurrentCycle() {
        this.config.matchType = cycles[this.currentCycle].matchType;
        this.config.showMatches = cycles[this.currentCycle].showMatches;
        this.config.showTables = cycles[this.currentCycle].showTables;
        this.showTable = cycles[this.currentCycle].showTables;
        this.updateDom(500);
    },


    loadReplacements: function(callback: (txt: string) => void) {
        const xmlRequest = new XMLHttpRequest();
        const path = this.file("replacements.json");
        xmlRequest.overrideMimeType("application/json");
        xmlRequest.open("GET", path, true);
        xmlRequest.onreadystatechange = function() {
            if (xmlRequest.readyState === 4 && xmlRequest.status === 200) {
                callback(xmlRequest.responseText);
            }
        };
        xmlRequest.send(null);
    },


    scheduleDOMUpdates: function() {
        this.refreshTimer = setInterval(this.showNextLeague.bind(this), this.config.updateInterval * 1000);
    },

    showNextLeague: function() {
        this.competitionIndex = this.competitionIndex >= this.leagues.length - 1 ? 0 : this.competitionIndex + 1;
        this.updateCurrentLeague();
    },

    updateCurrentLeague: function() {
        this.competition = this.leagues[this.competitionIndex];
        this.updateDom(500);

        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.scheduleDOMUpdates();
    },


    socketNotificationReceived: function(notification, payload) {
        if (notification === "SOCCER_DATA_RETRIEVED") {
            this.leagueDatas = payload as LeagueData[];
            if (this.loading === true) {
                this.loading = false;
            }
            this.updateDom();
        }

        if (this.loading === true && this.leagueDatas.length) {
            this.loading = false;
            this.updateDom();
        }
    },

    notificationReceived: function(notification, payload, sender) {
        if (notification === "DOM_OBJECTS_CREATED") {
            this.setupGestures();
        }
    },

    getStyles: function() {
        return ["MMM-soccer.css"];
    },

    getTranslations: function() {
        return {
            en: "translations/en.json",
            de: "translations/de.json",
            id: "translations/id.json",
            sv: "translations/sv.json",
            fr: "translations/fr.json"
        };
    },

    getTemplate: function() {
        return "MMM-soccer.njk";
    },

    getTemplateData: function(): TemplateData {
        return {
            config: this.config,
            showTable: this.showTable,
            matchViews: this.prepareMatches(),
            standingView: this.prepareStandings()
        };
    },


    prepareMatches: function() {
        if (!this.leagueDatas.length) {
            return {
                matchDayLabel: this.translate("LOADING")
            };
        }

        const matchViews: MatchView[] = [];

        if (this.config.matchType === "league") {
            const leagueData: LeagueData = this.leagueDatas.find((data: LeagueData) => data.competition.code === this.competition);

            this.showTable = this.config.showTables && typeof leagueData.matchDay !== "string";

            matchViews.push({
                matchDayLabel: `${this.translate("MATCHDAY")}: ${this.translate(leagueData.matchDay.toString())}`,
                competition: leagueData.competition.name,
                emblem: leagueData.competition.emblem,
                matches: leagueData.matches.filter((match: Match) => match.matchday === leagueData.matchDay)
            });

        } else if (this.config.matchType === "next") {
            const focusedTeams = Object.values(this.config.focus_on);

            const focusedTeamsMatches = this.leagueDatas
                .flatMap((leagueData: LeagueData) => leagueData.matches)
                .filter((match: Match) => focusedTeams.includes(match.homeTeam.name) || focusedTeams.includes(match.awayTeam.name))
                .filter((match: Match) => !moment(match.utcDate).isBefore())
                .toSorted((match1: Match, match2: Match) => moment(match1.utcDate).diff(moment(match2.utcDate)))
                .slice(0, this.config.numberOfNextMatches);

            matchViews.push({
                competition: "",
                matchDayLabel: this.translate("NEXT_MATCHES"),
                matches: focusedTeamsMatches
            });

        } else if (this.config.matchType === "daily") {
            const today = moment().subtract(this.config.daysOffset, "days");

            matchViews.push(
                ...this.leagueDatas.map((leagueData: LeagueData) => ({
                    competition: leagueData.competition.name,
                    matchDayLabel: "",
                    matches: leagueData.matches.filter(match => moment(match.utcDate).isSame(today, "day"))
                }))
            );
        }

        this.processMatches(matchViews);

        return matchViews;
    },

    processMatches(matchViews: MatchView[]) {
        const focusTeam = this.config.focus_on[this.competition];

        matchViews.forEach(matchView => {
            matchView.matches.forEach((match: Match) => {
                if (this.config.matchType === "league" || this.config.matchType === "daily") {
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
    },

    filterTables: function(): StandingEntry[] {
        if (!this.leagueDatas.length) return [];

        const focusTeam: string = this.config.focus_on[this.competition];
        const standings: Standing[] = this.leagueDatas
            .find((data: LeagueData) => data.competition.code === this.competition)
            ?.standings
            .filter((standing: Standing) => standing.type === "TOTAL");

        let table;
        if (standings.length > 1 && focusTeam) {			//cup mode
            return standings
                    .map((standing: Standing) => standing.table)
                    .find((standingEntries: StandingEntry[]) => standingEntries.some(entry => entry.team.name === focusTeam))
                ?? [];
        } else {
            table = standings[0].table;
        }
        return table;
    },


    prepareStandings: function(): StandingView {
        if (!this.leagueDatas.length) return { standings: [] };

        const standings = this.filterTables();

        if (!this.config.max_teams) return { standings };

        const focus = this.config.focus_on?.[this.competition];

        if (!focus || focus === "TOP") {
            return { standings: standings.slice(0, Math.min(this.config.max_teams, standings.length)) };
        }

        if (focus === "BOTTOM") {
            return { standings: standings.slice(Math.max(standings.length - this.config.max_teams, 0), standings.length) };
        }

        // Focus on team
        const focusedIndex = standings.indexOf(standings.find((s: StandingEntry) => s.team.name === focus));

        let startIndex = Math.max(0, focusedIndex - Math.floor(this.config.max_teams / 2));
        const endIndex = Math.min(standings.length - 1, startIndex + this.config.max_teams - 1);
        startIndex = Math.max(0, endIndex - this.config.max_teams + 1);

        return {
            focusTeam: focus,
            standings: standings.slice(startIndex, endIndex + 1)
        };
    },

    addFilters: function() {
        const njEnv = this.nunjucksEnvironment();
        njEnv.addFilter("replace", (originalName: string) => {
            if (!this.config.replace) return originalName;

            return this.replacements[this.config.replace]?.[originalName] ?? originalName;
        });
    }
});
