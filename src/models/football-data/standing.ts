import { StandingEntry } from "./standing-entry";

export interface Standing {
    stage: string;
    type: string;
    group: any;
    table: StandingEntry[];
}
