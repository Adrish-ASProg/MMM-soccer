import { Config } from "./config";
import { MatchView } from "./match-view";

export interface TemplateData {
    matchViews: MatchView[];
    boundaries: any;
    config: Config;
    isModalActive: any;
    modals: any;
    table: any;
    showTable: any;
    showMatchDay: any;
    voice: any;
}
