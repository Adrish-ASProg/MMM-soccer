import Hammer from "hammerjs";
import moment from "moment";
import { Config } from "./models/config";
import { DISPLAY_MODES } from "./models/cycle-mode";
import { Tables } from "./models/tables";
import { MatchesPerLeague } from "./models/matches-per-league";
import { Match } from "./models/football-data/match";
import { TemplateData } from "./models/template-data";
import { LeagueData } from "./models/league-data";
import { MatchView } from "./models/match-view";

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
        fadeFocus: true,
        max_teams: 0,
        logos: true,
        showTables: true,
        showMatches: true,
        showMatchDay: true,
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

    modals: {
        standings: false,
        help: false
    },

    voice: {
        mode: "SOCCER",
        sentences: [
            "OPEN HELP",
            "CLOSE HELP",
            "SHOW STANDINGS OF COUNTRY NAME",
            "EXPAND VIEW",
            "COLLAPSE VIEW"
        ]
    },

    loading: true,
    tables: {} as Record<string, Tables>,
    matches: {} as MatchesPerLeague,
    leagueDatas: [] as LeagueData[],
    matchDay: "",
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
        this.standing = this.filterTables();
        this.updateDom(500);

        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.scheduleDOMUpdates();
    },


    socketNotificationReceived: function(notification, payload) {
        if (notification === "TABLES") {
            this.tables = payload as Record<string, Tables>;
            this.standing = this.filterTables();
        } else if (notification === "SOCCER_DATA_RETRIEVED") {
            this.leagueDatas = payload as LeagueData[];
        }

        const isLoadedLegacy = this.tables.hasOwnProperty(this.competition);

        if (this.loading === true && (isLoadedLegacy || this.leagueDatas.length)) {
            this.loading = false;
            this.updateDom();
        }
    },

    notificationReceived: function(notification, payload, sender) {
        if (notification === "ALL_MODULES_STARTED") {
            const voice = Object.assign({}, this.voice);
            voice.sentences.push(Object.keys(this.config.leagues).join(" "));
            this.sendNotification("REGISTER_VOICE_MODULE", voice);
        } else if (notification === "DOM_OBJECTS_CREATED") {
            this.setupGestures();
        } else if (notification === "VOICE_SOCCER" && sender.name === "MMM-voice") {
            this.checkCommands(payload);
        } else if (notification === "VOICE_MODE_CHANGED" && sender.name === "MMM-voice" && payload.old === this.voice.mode) {
            this.closeAllModals();
            this.updateDom(500);
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
            boundaries: (this.tables.hasOwnProperty(this.competition)) ? this.calculateTeamDisplayBoundaries(this.competition) : {},
            config: this.config,
            isModalActive: this.isModalActive(),
            modals: this.modals,
            table: this.standing,
            showTable: this.showTable,
            showMatchDay: this.config.showMatchDay,
            voice: this.voice,
            matchViews: this.prepareMatches()
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

    filterTables: function() {
        const tables: Tables = this.tables[this.competition];
        const focusTeam: string = this.config.focus_on[this.competition];

        //filtering out "home" and "away" tables
        if (tables && !tables.standings) return "";

        const standings = tables.standings.filter(table => table.type === "TOTAL");

        let table;
        if (standings.length > 1 && this.config.focus_on.hasOwnProperty(tables.competition.code)) {			//cup mode
            return standings
                .map(standing => standing.table)
                .find(standingEntry => standingEntry.some(entry => entry.team.name === focusTeam));
        } else {
            table = standings[0].table;
        }
        return table;
    },


    findFocusTeam: function() {
        this.log("Finding focus team for table...");
        let focusTeamIndex = -1;
        const table = this.standing;
        for (let i = 0; i < table.length; i++) {
            if (table[i].team.name === this.config.focus_on[this.competition]) {
                focusTeamIndex = i;
                this.log("Focus Team found: " + table[i].team.name);
                break;
            }
        }

        if (focusTeamIndex < 0) {
            this.log("No Focus Team found! Please check your entry!");
            return {
                focusTeamIndex: -1,
                firstTeam: 0,
                lastTeam: this.config.max_teams || this.standing.length
            };
        } else {
            const { firstTeam, lastTeam } = this.getFirstAndLastTeam(focusTeamIndex);
            return { focusTeamIndex, firstTeam, lastTeam };
        }
    },


    getFirstAndLastTeam: function(index: number) {
        let firstTeam;
        let lastTeam;

        if (this.config.max_teams) {
            const before = Math.round(this.config.max_teams / 2);
            firstTeam = (index - before >= 0) ? (index - before) : 0;
            if (firstTeam + this.config.max_teams <= this.standing.length) {
                lastTeam = firstTeam + this.config.max_teams;
            } else {
                lastTeam = this.standing.length;
                /*firstTeam = lastTeam - this.config.max_teams >= 0 ?
                    lastTeam - this.config.max_teams : 0;*/
            }
        } else {
            firstTeam = 0;
            lastTeam = this.standing.length;
        }
        this.log({ firstTeam, lastTeam });
        return { firstTeam, lastTeam };
    },


    calculateTeamDisplayBoundaries: function(competition: string) {
        this.log("Calculating Team Display Boundaries");
        if (this.config.focus_on && this.config.focus_on.hasOwnProperty(competition)) {
            if (this.config.focus_on[competition] === "TOP") {
                this.log("Focus on TOP");
                return {
                    focusTeamIndex: -1,
                    firstTeam: 0,
                    lastTeam: this.isMaxTeamsLessAll() ? this.config.max_teams : this.standing.length
                };
            } else if (this.config.focus_on[this.leagues] === "BOTTOM") {
                this.log("Focus on BOTTOM");
                return {
                    focusTeamIndex: -1,
                    firstTeam: this.isMaxTeamsLessAll() ? this.standing.length - this.config.max_teams : 0,
                    lastTeam: this.standing.length
                };
            }
            this.log("Focus on Team");
            return this.findFocusTeam();
        }

        return {
            focusTeamIndex: -1,
            firstTeam: 0,
            lastTeam: this.config.max_teams || this.standing.length
        };
    },


    isMaxTeamsLessAll: function() {
        return (this.config.max_teams && this.config.max_teams <= this.standing.length);
    },


    handleModals: function(data: any, modal: string, open: RegExp, close: RegExp) {
        if (close.test(data) || (this.modals[modal] && !open.test(data))) {
            this.closeAllModals();
        } else if (open.test(data) || (!this.modals[modal] && !close.test(data))) {
            this.closeAllModals();
            this.modals[modal] = true;
        }

        const modules = document.querySelectorAll(".module");
        for (let i = 0; i < modules.length; i += 1) {
            if (!modules[i].classList.contains("MMM-soccer")) {
                if (this.isModalActive()) {
                    modules[i].classList.add("MMM-soccer-blur");
                } else {
                    modules[i].classList.remove("MMM-soccer-blur");
                }
            }
        }
    },


    closeAllModals: function() {
        const modals = Object.keys(this.modals);
        modals.forEach((modal) => {
            this.modals[modal] = false;
        });
    },


    isModalActive: function() {
        const modals = Object.keys(this.modals);
        return modals.some(modal => this.modals[modal] === true);
    },


    checkCommands: function(data: any) {
        if (/(HELP)/g.test(data)) {
            this.handleModals(data, "help", /(OPEN)/g, /(CLOSE)/g);
        } else if (/(VIEW)/g.test(data)) {
            this.handleModals(data, "standings", /(EXPAND)/g, /(COLLAPSE)/g);
        } else if (/(STANDINGS)/g.test(data)) {
            const countries = Object.keys(this.config.leagues);
            for (let i = 0; i < countries.length; i += 1) {
                const regexp = new RegExp(countries[i], "g");
                if (regexp.test(data)) {
                    this.closeAllModals();
                    if (this.currentLeague !== this.config.leagues[countries[i]]) {
                        this.currentLeague = this.config.leagues[countries[i]];
                        this.getData();
                    }
                    break;
                }
            }
        }
        this.updateDom(300);
    },


    addFilters: function() {
        const njEnv = this.nunjucksEnvironment();
        njEnv.addFilter("fade", (index: number, focus: number) => {
            if (this.config.max_teams && this.config.fadeFocus && focus >= 0) {
                if (index !== focus) {
                    const currentStep = Math.abs(index - focus);
                    return `opacity: ${1 - ((1 / this.config.max_teams) * currentStep)}`;
                }
            }
            return "";
        });

        njEnv.addFilter("replace", (team: string) => {
            const replace = this.config.replace;
            if ((replace === "default" || replace === "short") && (this.replacements.default.hasOwnProperty(team))) {
                return this.replacements[replace][team];
            } else {
                return team;
            }
        });
    },

    log: function(msg: any) {
        if (this.config && this.config.debug) {
            console.log(this.name + ":", JSON.stringify(msg));
        }
    }
});
