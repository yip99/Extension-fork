<template>
	<template v-if="chatSettingsPopup">
		<SettingsChatHook :el="chatSettingsPopup" @open-settings="ctx.open = true" />
	</template>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useEventListener } from "@vueuse/core";
import { declareModule } from "@/composable/useModule";
import SettingsChatHook from "./SettingsChatHook.vue";
import { useSettingsMenu } from "@/app/settings/Settings";

declareModule<"KICK">("settings", {
	name: "Settings",
	depends_on: [],
});

const ctx = useSettingsMenu();

// Acquire vue app

const chatSettingsPopup = ref<HTMLElement | null>(null);

function handle(): void {
	chatSettingsPopup.value = document.querySelector(".chat-actions-popup");
}

useEventListener(window, "popstate", () => setTimeout(handle, 0));
useEventListener(document, "click", () => setTimeout(handle, 0), {
	capture: true,
});
</script>
