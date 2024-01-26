import { Config } from "./config";
import { MatchView } from "./match-view";

export interface TemplateData {
    matchViews: MatchView[];
    boundaries: any;
    config: Config;
    table: any;
    showTable: any;
    showMatchDay: any;
}
