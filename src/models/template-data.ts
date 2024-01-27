import { Config } from "./config";
import { MatchView } from "./match-view";
import { StandingView } from "./standing-view";

export interface TemplateData {
    matchViews: MatchView[];
    standingView: StandingView;
    config: Config;
    showTables: boolean;
}
