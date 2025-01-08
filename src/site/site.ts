import { log } from "@/common/Logger";
import { loadSite } from "./site.normal";

(async () => {
	log.info("<Site>", "Using Local Mode,", "v" + import.meta.env.VITE_APP_VERSION);
	loadSite();
})();
