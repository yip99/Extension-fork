kj
<template>
	<!-- Patch messages -->
	<template v-for="bind of messages" :key="bind.id">
		<ChatMessageVue :bind="bind" @open-card="onOpenUserCard" />
	</template>

	<!-- Modify user card -->
	<template v-for="x of userCard" :key="x.el">
		<ChatUserCard :el="x.el" :bind="x.bind" />
	</template>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from "vue";
import { useMutationObserver } from "@vueuse/core";
import { ObserverPromise } from "@/common/Async";
import { getReactProps } from "@/common/ReactHooks";
import ChatMessageVue, { ChatMessageBinding } from "./ChatMessage.vue";
import ChatUserCard from "./ChatUserCard.vue";

interface ActiveUserCard {
	bind: ChatMessageBinding;
	el: HTMLDivElement;
}

const props = defineProps<{
	listElement: HTMLDivElement;
}>();

const messages = ref<ChatMessageBinding[]>([]);
const messageBuffer = ref<ChatMessageBinding[]>([]);
const messageDeleteBuffer = ref<ChatMessageBinding[]>([]);
const messageMap = reactive<WeakMap<HTMLDivElement, ChatMessageBinding>>(new WeakMap());
const userCard = ref<ActiveUserCard[]>([]);

function isDefaultReactMessageProps(props: unknown): props is Kick.Message.DefaultProps {
	return (
		props != null &&
		typeof props === "object" &&
		"sender" in props &&
		typeof props.sender === "object" &&
		"message" in props &&
		typeof props.message === "object"
	);
}

function getMessageReactProps(el: HTMLDivElement): Kick.Message.DefaultProps | undefined {
	const messageElements = el.querySelector("div > div[style*='chatroom-font-size']");
	if (!messageElements) return;
	const props = getReactProps<Kick.Message.MessageListProps>(messageElements);
	if (!props || !Array.isArray(props.children)) return;

	const child = props.children.find((child) => child?.props?.sender);
	return child?.props;
}

function patchMessageElement(el: HTMLDivElement & { __seventv?: boolean }, noBuffer?: boolean): void {
	if (el.__seventv) return; // already patched
	if (!el.hasAttribute("data-index")) return; // not a message
	const props = getMessageReactProps(el);
	if (!props) return;

	el.__seventv = true;

	const entryID = isDefaultReactMessageProps(props) ? props.messageId : props;
	const userID = props.sender.id.toString();
	const username = props.sender.username;
	const usernameEl = el.querySelector<HTMLSpanElement>("div.inline-flex > button[title]")!;
	const textElements = el.querySelectorAll<HTMLSpanElement>("span.font-normal");

	const bind: ChatMessageBinding = {
		id: entryID,
		authorID: userID,
		authorName: username,
		texts: Array.from(textElements),
		usernameEl: usernameEl,
		el,
	};

	if (!noBuffer) el.classList.add("seventv-chat-message-buffered");

	messageBuffer.value.push(bind);
	messageMap.set(el, bind);
}

async function onOpenUserCard(bind: ChatMessageBinding) {
	const parent = document.getElementById("chatroom");
	if (!parent) return;

	let el = parent.querySelector<HTMLDivElement>(".user-profile");
	if (!el) {
		el = await new ObserverPromise<HTMLDivElement>(
			(records, emit) => {
				for (const rec of records) {
					rec.addedNodes.forEach((n) => {
						if (!(n instanceof HTMLDivElement)) return;
						if (!n.classList.contains("user-profile")) return;
						emit(n);
					});
				}
			},
			parent,
			{ childList: true },
		);
	}

	userCard.value.length = 0;
	nextTick(() => {
		if (!el) return;
		userCard.value.push({ el, bind });
	});
}

function patch(): void {
	const entries = props.listElement.querySelectorAll("[data-index]");
	for (const el of Array.from(entries)) {
		patchMessageElement(el as HTMLDivElement, true);
	}
}

const expectPause = ref(false);
const bounds = ref(props.listElement.getBoundingClientRect());
let unpauseListenerAttached = false;

function onMessageRendered() {
	if (props.listElement.nextElementSibling && !unpauseListenerAttached) {
		unpauseListenerAttached = true;
		props.listElement.addEventListener("click", onUnpauseClick);
	}
	if (expectPause.value) return;

	nextTick(() => {
		props.listElement.scrollTo({ top: props.listElement.scrollHeight });
	});
}

function onUnpauseClick(): void {
	props.listElement.removeEventListener("click", onUnpauseClick);
	expectPause.value = false;
	unpauseListenerAttached = false;
}

onMounted(() => {
	const el = props.listElement;
	if (!el) return;

	el.addEventListener("wheel", () => {
		const top = Math.floor(el.scrollTop);
		const h = Math.floor(el.scrollHeight - bounds.value.height);

		if (top >= h - 1) {
			expectPause.value = false;
			return;
		}

		expectPause.value = true;
	});
});

onUnmounted(() => {
	props.listElement.removeEventListener("click", onUnpauseClick);
});

watchEffect(() => {
	patch();

	bounds.value = props.listElement.getBoundingClientRect();

	props.listElement.classList.toggle("seventv-chat-observer", true);
});

let stop = () => {
	void 0;
};
watch(
	() => props.listElement,
	() => {
		stop();
		stop = useMutationObserver(
			props.listElement,
			(records) => {
				for (const rec of records) {
					rec.addedNodes.forEach((n) => {
						if (!(n instanceof HTMLDivElement)) return;

						patchMessageElement(n);
					});

					rec.removedNodes.forEach((n) => {
						if (!(n instanceof HTMLDivElement)) return;

						const b = messageMap.get(n);
						if (!b) return;

						messageDeleteBuffer.value.push(b);
						messageMap.delete(n);
					});

					flush();
				}
			},
			{ childList: true },
		).stop;
		flush();
	},
	{ immediate: true },
);

function flush(): void {
	if (messageBuffer.value.length) {
		const unbuf = messageBuffer.value.splice(0, messageBuffer.value.length);

		for (const bind of unbuf) {
			bind.el.classList.remove("seventv-chat-message-buffered");
		}
		messages.value.push(...unbuf);
	}

	if (messageDeleteBuffer.value.length >= 25) {
		for (const bind of messageDeleteBuffer.value) {
			messages.value.splice(messages.value.indexOf(bind), 1);
		}

		messageDeleteBuffer.value.length = 0;
	}
	onMessageRendered();
}

// ftk789: I have no clue what the F is above, And why does it have setTimeouts, with it being present it lags the chat and makes it go crazy.so I just commented settimeouts.

useMutationObserver(
	props.listElement.parentElement!,
	() => {
		if (props.listElement.nextElementSibling) return;

		expectPause.value = false;
	},
	{ childList: true },
);

onUnmounted(() => {
	props.listElement.classList.toggle("seventv-chat-observer", false);
});
</script>

<style scoped lang="scss">
.seventv-emote-menu-button {
	display: grid;
	align-items: center;
	border: none;
	background: transparent;
	cursor: pointer;
	transition: background 0.2s ease-in-out;
	height: 2.25rem;
	border-radius: 0.25rem;
	padding: 0 0.5rem;

	&:hover {
		background: rgba(255, 255, 255, 10%);
	}

	.icon {
		font-size: 1.25rem;
	}
}
</style>

<style lang="scss">
.seventv-chat-message-buffered {
	display: none !important;
}
</style>
