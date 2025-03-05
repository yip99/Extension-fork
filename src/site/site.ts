import { log } from "@/common/Logger";
import { semanticVersionToNumber } from "@/common/Transform";
import { loadSite } from "./site.normal";

(async () => {
    log.info("<Site>", "Using Local Mode,", "v" + import.meta.env.VITE_APP_VERSION);
    loadSite();
})();
