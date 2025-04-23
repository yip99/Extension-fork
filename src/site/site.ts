import { log } from "@/common/Logger";
import { semanticVersionToNumber } from "@/common/Transform";
import { loadSite } from "./site.normal";

(async () => {
	const host: string = import.meta.env.VITE_APP_HOST;
	const versionBranch: string = import.meta.env.VITE_APP_VERSION_BRANCH;

	const manifestURL = `${host}/manifest${versionBranch ? "." + versionBranch.toLowerCase() : ""}.json`;

	const manifest = await fetch(manifestURL)
		.then((res) => res.json())
		.catch((err) => log.error("<Site>", "Failed to fetch host manifest", err.message));

	(window as Window & { seventv?: SeventvGlobalScope }).seventv = {
		host_manifest: manifest ?? null,
	};

    log.info("<Site>", "Using Local Mode,", "v" + import.meta.env.VITE_APP_VERSION);
    loadSite();
})();
