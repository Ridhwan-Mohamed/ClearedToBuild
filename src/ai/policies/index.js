import { BuilderPolicy } from "./BuilderPolicy";
import { ForagerPolicy } from "./ForagerPolicy";
import { FarmerPolicy } from "./FarmerPolicy";
import { FiremanPolicy } from "./FiremanPolicy";
import { BlademasterPolicy } from "./BlademasterPolicy";
import { BrawlerPolicy } from "./BrawlerPolicy";
import { GunslingerPolicy } from "./GunslingerPolicy";

export const POLICIES = {
    Builder: new BuilderPolicy(),
    Forager: new ForagerPolicy(),
    Farmer: new FarmerPolicy(),
    Fireman: new FiremanPolicy(),
    Blademaster: new BlademasterPolicy(),
    Brawler: new BrawlerPolicy(),
    Gunslinger: new GunslingerPolicy(),
};

