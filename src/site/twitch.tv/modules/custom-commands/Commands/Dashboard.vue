<template>
	<Tray
		v-if="showTray"
		placeholder="Search again..."
		:input-value-override="search"
		disable-commands
		floating
		:message-handler="(m) => (search = m)"
	>
		<EnableTray :search="search" :mut="mut" name="body" @close="showTray = false" />
	</Tray>
	<Tray v-if="showLogin">
		<a class="tray-notice" href="#" @click="openAuthPage"> Authenticate extension to manage emotes </a>
	</Tray>
</template>
<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { refAutoReset } from "@vueuse/core";
import { SEVENTV_EMOTE_ID, SEVENTV_EMOTE_LINK } from "@/common/Constant";
import { SevenTVRoles } from "@/common/Roles";
import { useActor } from "@/composable/useActor";
import { useSetMutation } from "@/composable/useSetMutation";
import EnableTray from "./components/EnableTray.vue";
import { useSettingsMenu } from "@/app/settings/Settings";
import Tray from "../../chat/components/tray/Tray.vue";
import { FetchResult } from "@apollo/client";
import { GraphQLError } from "graphql";

const emoteNameRegex = new RegExp("^[-_A-Za-z():0-9]{2,100}$");

const props = defineProps<{
	add: (c: Twitch.ChatCommand) => void;
	remove: (c: Twitch.ChatCommand) => void;
}>();

const mut = useSetMutation();
const sCtx = useSettingsMenu();

const openAuthPage = (e: MouseEvent) => {
	e.preventDefault();
	showLogin.value = false;
	sCtx.open = true;
	sCtx.switchView("profile");
	return false;
};

const search = ref("");
const showTray = ref(false);
const showLogin = refAutoReset<boolean>(false, 10000);

async function handle(p: Promise<FetchResult | undefined>): Promise<Twitch.ChatCommand.AsyncResult> {
	return await p
		.then(() => ({}))
		.catch((e: GraphQLError) => {
			if (e.extensions?.code === 70401 && mut.needsLogin) {
				showLogin.value = true;
				return {};
			}

			return {
				notice: ("Unable to do request: " + e.message) as string,
				error: "unauthorized",
			};
		});
}

async function handleSearch(args: string) {
	search.value = args.split(" ").filter((n) => n)[0];

	return nextTick(() => (showTray.value = true)).then(() => ({}));
}

async function handleEnable(args: string) {
	const linkMatch = args.match(SEVENTV_EMOTE_LINK);
	if (linkMatch && linkMatch.groups?.emoteID) {
		return handle(mut.add(linkMatch.groups.emoteID));
	}

	const emoteIDMatch = args.match(SEVENTV_EMOTE_ID);
	if (emoteIDMatch) {
		return handle(mut.add(emoteIDMatch[0]));
	}

	return {
		notice: "Invalid 7TV emote link or ID.",
		error: "invalid_parameters",
	};
}

async function handleDisable(args: string) {
	const [emoteName] = args.split(" ").filter((n) => n);

	const emote = mut.set?.emotes.find((e) => e.name === emoteName);

	if (!emote) {
		return {
			notice: emote ? "The emote is not in a set that you can edit." : "Could not find selected 7TV emote.",
			error: "invalid_parameters",
		};
	}

	return handle(mut.remove(emote.id));
}

async function handleAlias(args: string) {
	const [currentName, newName] = args.split(" ").filter((n) => n);

	const emote = mut.set?.emotes.find((e) => e.name === currentName);

	if (!emote) {
		return {
			notice: emote ? "The emote is not in a set that you can edit." : "Could not find selected 7TV emote.",
			error: "invalid_parameters",
		};
	}

	if (newName && !emoteNameRegex.test(newName)) {
		return {
			notice: "Illegal characters in new alias",
			error: "invalid_parameters",
		};
	}
	return handle(mut.rename(emote.id, newName));
}

const canEdit = () => (mut.canEditSet || mut.needsLogin ? 0 : 3);

const commandSearch: Twitch.ChatCommand = {
	name: "search",
	get description() {
		return !mut.canEditSet ? "Search for 7TV emote" : "Search for 7TV emote and add/remove it";
	},
	helpText:
		"Search for a 7TV emote, and add/remove it if you have the permission. Green outline indicates the emote is already added, red outline indicates a name conflict and gold outline indicates a zero-width emote.",
	permissionLevel: 0,
	handler: (args) => {
		return { deferred: handleSearch(args) };
	},
	commandArgs: [
		{
			name: "emote",
			isRequired: true,
		},
	],
	group: "7TV",
};

const commandEnable: Twitch.ChatCommand = {
	name: "add",
	description: "Add a 7TV emote",
	helpText: "Add a 7TV emote using a link or 7TV emote ID.",
	get permissionLevel() {
		return canEdit();
	},
	handler: (args) => {
		return { deferred: handleEnable(args) };
	},
	commandArgs: [
		{
			name: "link or ID",
			isRequired: true,
		},
	],
	group: "7TV",
};

const commandDisable: Twitch.ChatCommand = {
	name: "remove",
	description: "Remove a 7TV emote",
	helpText: "Remove a 7TV emote by name.",
	get permissionLevel() {
		return canEdit();
	},
	handler: (args) => {
		return { deferred: handleDisable(args) };
	},
	commandArgs: [
		{
			name: "emote",
			isRequired: true,
		},
	],
	group: "7TV",
};

const commandAlias: Twitch.ChatCommand = {
	name: "rename",
	description: "Rename a 7TV emote",
	helpText: "Rename a 7TV emote from current name to new name.",
	get permissionLevel() {
		return canEdit();
	},
	handler: (args) => {
		return { deferred: handleAlias(args) };
	},
	commandArgs: [
		{
			name: "current",
			isRequired: true,
		},
		{
			name: "new",
			isRequired: false,
		},
	],
	group: "7TV",
};

const actor = useActor();
const perms = [SevenTVRoles.ADMIN, SevenTVRoles.MODERATOR] as string[];

const commandEditAnySet: Twitch.ChatCommand = {
	name: "letmemanageemoteset",
	description: "<Mod> Lets you edit any 7TV emote set",
	helpText: "",
	permissionLevel: 0,
	handler: () => {
		actor.editAnySet = true;
	},
	group: "7TV",
	get hidden() {
		return actor.editAnySet || mut.canEditSet || !actor.user?.roles?.some((v) => perms.includes(v));
	},
};

onMounted(() => {
	props.add(commandSearch);
	props.add(commandEnable);
	props.add(commandDisable);
	props.add(commandAlias);
	props.add(commandEditAnySet);
});

onUnmounted(() => {
	props.remove(commandSearch);
	props.remove(commandEnable);
	props.remove(commandDisable);
	props.remove(commandAlias);
	props.remove(commandEditAnySet);
});
</script>

<style scoped lang="scss">
.tray-notice {
	display: block;
	text-align: center;
}
</style>
