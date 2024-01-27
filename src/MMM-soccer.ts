import Hammer from "hammerjs";
import { Config } from "./models/config";
import { DISPLAY_MODES } from "./models/cycle-mode";
import { TemplateData } from "./models/template-data";
import { LeagueData } from "./models/league-data";
import { StandingEntry } from "./models/football-data/standing-entry";
import { StandingView } from "./models/standing-view";
import { Standing } from "./models/football-data/standing";
import { ViewBuilder } from "./view-builder";

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

    leagueDatas: [] as LeagueData[],

    replacements: {
        default: {}
    },
    loading: true,
    competitions: [] as string[],
    currentCompetition: "",
    competitionIndex: 0,
    refreshTimer: undefined,
    currentCycle: 0,

    start: function() {
        this.addFilters();
        this.competitions = this.config.show;
        this.currentCompetition = this.competitions[0];
        const self = this;
        this.loadReplacements((response: string) => {
            self.replacements = JSON.parse(response);
        });
        this.sendSocketNotification("GET_SOCCER_DATA", this.config);
        this.scheduleDOMUpdates();
    },


    scheduleDOMUpdates: function() {
        this.refreshTimer = setInterval(this.showNextLeague.bind(this), this.config.updateInterval * 1000);
    },

    showNextLeague: function() {
        this.competitionIndex = this.competitionIndex >= this.competitions.length - 1 ? 0 : this.competitionIndex + 1;
        this.updateCurrentLeague();
    },

    updateCurrentLeague: function() {
        this.currentCompetition = this.competitions[this.competitionIndex];
        this.updateDom(500);

        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.scheduleDOMUpdates();
    },


    prepareMatches: function() {
        if (!this.leagueDatas.length) {
            return { matchDayLabel: this.translate("LOADING") };
        }

        const focusTeam = this.config.focus_on[this.currentCompetition];

        if (this.config.matchType === "league") {
            const leagueData: LeagueData = this.leagueDatas.find((data: LeagueData) => data.competition.code === this.currentCompetition)!;

            return ViewBuilder.toLeagueMatchView(
                leagueData,
                `${this.translate("MATCHDAY")}: ${this.translate(leagueData.matchDay.toString())}`,
                focusTeam);
        }

        if (this.config.matchType === "next") {
            return ViewBuilder.toNextMatchView(
                this.leagueDatas,
                this.config.numberOfNextMatches,
                this.translate("NEXT_MATCHES"),
                Object.values(this.config.focus_on));
        }

        if (this.config.matchType === "daily") {
            return ViewBuilder.toDailyMatchView(this.leagueDatas, this.config.daysOffset, focusTeam);
        }

        return [];
    },

    filterTables: function(): StandingEntry[] {
        if (!this.leagueDatas.length) return [];

        const focusTeam: string = this.config.focus_on[this.currentCompetition];
        const standings: Standing[] = this.leagueDatas
            .find((data: LeagueData) => data.competition.code === this.currentCompetition)
            ?.standings
            .filter((standing: Standing) => standing.type === "TOTAL");

        // Cups, only return the group containing the focused team if any
        if (standings.length > 1 && focusTeam) {
            return standings
                    .map((standing: Standing) => standing.table)
                    .find((standingEntries: StandingEntry[]) => standingEntries.some(entry => entry.team.name === focusTeam))
                ?? [];
        }

        return standings[0].table;
    },


    prepareStandings: function(): StandingView {
        if (!this.leagueDatas.length) return { standings: [] };

        const standings = this.filterTables();

        if (!this.config.max_teams) return { standings };

        const focus = this.config.focus_on?.[this.currentCompetition];

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

    getTemplateData: function(): TemplateData {
        return {
            config: this.config,
            showTables: this.config.showTables,
            matchViews: this.prepareMatches(),
            standingView: this.prepareStandings()
        };
    },


    //#region #################### GESTURES ####################

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
        this.updateDom(500);
    },

    //#endregion ################################################


    //#region ############### SETUP / NOTIFICATIONS ###############

    socketNotificationReceived: function(notification, payload) {
        if (notification !== "SOCCER_DATA_RETRIEVED" || !payload.length) return;

        this.leagueDatas = payload as LeagueData[];
        if (this.loading === true) this.loading = false;
        this.updateDom();
    },

    notificationReceived: function(notification, payload, sender) {
        if (notification === "DOM_OBJECTS_CREATED") {
            this.setupGestures();
        }
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

    addFilters: function() {
        const njEnv = this.nunjucksEnvironment();
        njEnv.addFilter("replace", (originalName: string) => {
            if (!this.config.replace) return originalName;

            return this.replacements[this.config.replace]?.[originalName] ?? originalName;
        });
    },

    getScripts: function() {
        return [this.file("node_modules/hammerjs/hammer.js")];
    },

    getStyles: function() {
        return ["MMM-soccer.css"];
    },

    getTemplate: function() {
        return "MMM-soccer.njk";
    },

    getTranslations: function() {
        return {
            en: "translations/en.json",
            de: "translations/de.json",
            id: "translations/id.json",
            sv: "translations/sv.json",
            fr: "translations/fr.json"
        };
    }

    //#endregion #############################################
});
