<script setup vapor>
import { computed, nextTick, ref, unref, watch } from "vue";
import { useCodeMirror } from "../composables/useCodeMirror.js";
import { problemLocation } from "../utils/compiler-output.js";

/** @typedef {{severity: string, file: string, line: (number|null), column: (number|null), message: string}} Problem */
/** @typedef {{text: string, kind: string}} OutputLine */

const props = /** @type {{files: Record<string, string>, activeFile: string, problems: Problem[], output: OutputLine[], requestCompletions: (position: number) => Promise<any[]>}} */ (defineProps({
	files: { type: Object, required: true },
	activeFile: { type: String, required: true },
	problems: { type: Array, required: true },
	output: { type: Array, required: true },
	requestCompletions: { type: Function, required: true },
}));

const emit = defineEmits(["select-file", "create-file", "update-file"]);

// Normalize values at the component boundary. App passes top-level unwrapped
// refs, but this also keeps the workspace safe if a future caller passes a
// composable ref directly.
const fileMap = computed(() => unref(props.files) || {});
const currentFile = computed(() => unref(props.activeFile) || "");
const problemList = computed(() => {
	const value = unref(props.problems);
	return Array.isArray(value) ? value : [];
});
const outputLines = computed(() => {
	const value = unref(props.output);
	return Array.isArray(value) ? value : [];
});

// ---------- Workspace tabs ----------

const isCreating = ref(false);
const newFileName = ref("");
/** @type {import('vue').Ref<HTMLInputElement|null>} */
const newFileInput = ref(null);
const fileNames = computed(() => Object.keys(fileMap.value));

function openCreateInput() {
	isCreating.value = true;
	newFileName.value = "";
	nextTick(() => newFileInput.value?.focus());
}

function cancelCreate() {
	isCreating.value = false;
	newFileName.value = "";
}

function submitCreate() {
	const name = newFileName.value;
	if (!name.trim()) return;
	emit("create-file", name);
	cancelCreate();
}

/** @param {string} filename */
function selectFile(filename) {
	emit("select-file", filename);
}

// ---------- CodeMirror editor ----------

const editorHost = ref(null);
const editor = useCodeMirror({
	host: editorHost,
	getDocument: () => fileMap.value[currentFile.value] ?? "",
	onChange: (value) => {
		emit("update-file", { name: currentFile.value, content: value });
	},
	requestCompletions: (position) => props.requestCompletions(position),
});

watch(
	() => currentFile.value,
	async () => {
		await nextTick();
		editor.setDocument(fileMap.value[currentFile.value] ?? "");
	},
);

watch(
	() => fileMap.value[currentFile.value] ?? "",
	(value) => {
		if (value !== editor.getDocument()) editor.setDocument(value);
	},
);

// ---------- Problems and output ----------

const problemsOpen = ref(false);
const outputOpen = ref(false);
const errorCount = computed(() =>
	problemList.value.filter((problem) => problem.severity === "error").length,
);
const warningCount = computed(() =>
	problemList.value.filter((problem) => problem.severity === "warning").length,
);
const problemsStatus = computed(() =>
	problemList.value.length
		? `${errorCount.value} error${errorCount.value === 1 ? "" : "s"}, ${warningCount.value} warning${warningCount.value === 1 ? "" : "s"}`
		: "No issues",
);

// A failed compile should surface its diagnostics immediately, while an
// edit clears the panel through the compiler composable just like an IDE.
watch(
	() => problemList.value,
	(nextProblems) => {
		if (nextProblems.length) {
			problemsOpen.value = true;
			outputOpen.value = false;
		} else {
			problemsOpen.value = false;
		}
	},
);

function toggleProblems() {
	problemsOpen.value = !problemsOpen.value;
	if (problemsOpen.value) outputOpen.value = false;
}

function toggleOutput() {
	outputOpen.value = !outputOpen.value;
	if (outputOpen.value) problemsOpen.value = false;
}

/** @param {Problem} problem */
async function revealProblem(problem) {
	const target = Object.keys(fileMap.value).find((name) => problem.file?.endsWith(name));
	if (target && target !== currentFile.value) emit("select-file", target);

	await nextTick();
	editor.reveal(problem);
}
</script>

<template>
	<div class="editor-container">
		<div class="tabbar" role="tablist" aria-label="Swift files">
			<button
				v-for="name in fileNames"
				:key="name"
				role="tab"
				type="button"
				class="tab"
				:class="{ active: name === currentFile }"
				:aria-selected="name === currentFile"
				@click="selectFile(name)"
			>
				<span>{{ name }}</span>
			</button>

			<div v-if="isCreating" class="new-tab">
				<input
					ref="newFileInput"
					v-model="newFileName"
					type="text"
					placeholder="NewFile.swift"
					autocomplete="off"
					@keydown.enter.prevent="submitCreate"
					@keydown.esc.prevent="cancelCreate"
					@blur="cancelCreate"
				/>
			</div>

			<button
				v-if="!isCreating"
				type="button"
				class="tab tab-add"
				title="New Swift file"
				@click="openCreateInput"
			>
				+
			</button>
		</div>

		<div ref="editorHost" class="cm-host"></div>

		<div class="problems-bar">
			<button
				class="problems-toggle"
				:class="{ 'has-errors': errorCount, 'has-warnings': !errorCount && warningCount }"
				type="button"
				:aria-expanded="problemsOpen"
				@click="toggleProblems"
			>
				<span class="problems-icon">{{ errorCount || warningCount ? '!' : '✓' }}</span>
				<span>Problems</span>
				<span class="problems-count">{{ problemList.length }}</span>
			</button>
			<button
				class="output-toggle"
				:class="{ 'has-output': outputLines.length }"
				type="button"
				:aria-expanded="outputOpen"
				@click="toggleOutput"
			>
				<span class="output-icon">{{ outputLines.length ? '•' : '›' }}</span>
				<span>Output</span>
				<span class="output-count">{{ outputLines.length }}</span>
			</button>
			<span class="problems-status">{{ problemsStatus }}</span>
		</div>

		<div class="problems-panel" :class="{ 'is-hidden': !problemsOpen }">
			<div v-if="!problemList.length" class="problems-empty">No Swift problems detected.</div>
			<button
				v-for="problem in problemList"
				:key="`${problem.severity}:${problem.file}:${problem.line}:${problem.column}:${problem.message}`"
				type="button"
				:class="['problem-item', problem.severity]"
				@click="revealProblem(problem)"
			>
				<span class="problem-severity"></span>
				<span class="problem-location">{{ problemLocation(problem) }}</span>
				<span class="problem-message">{{ problem.message }}</span>
			</button>
		</div>

		<div class="output-panel" :class="{ 'is-hidden': !outputOpen }">
			<div v-if="!outputLines.length" class="output-empty">Run the active Swift file to see its output.</div>
			<div
				v-for="(line, index) in outputLines"
				:key="`${index}:${line.text}`"
				:class="['output-line', line.kind || 'stdout']"
			>
				{{ line.text }}
			</div>
		</div>
	</div>
</template>
