import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode, registerList } from '@lexical/list';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import {
	$getRoot,
	$getSelection,
	$isRangeSelection,
	createEditor,
	FORMAT_TEXT_COMMAND,
	type LexicalEditor,
} from 'lexical';
import { createEffect, createSignal, onSettled, untrack } from 'solid-js';

const EXTERNAL_VALUE_TAG = 'admin-external-value';

export type RichTextEditorProps = {
	disabled?: boolean;
	label: string;
	onChange?: (html: string) => void;
	value?: string;
};

export function RichTextEditor(props: RichTextEditorProps) {
	let rootElement: HTMLDivElement | undefined;
	let editor: LexicalEditor | undefined;
	const initialValue = untrack(() => props.value ?? '');
	let lastParentValue = initialValue;
	let lastEmittedValue: string | undefined;
	let lastGeneratedHtml = initialValue;
	const [ready, setReady] = createSignal(false);
	const [isBold, setIsBold] = createSignal(false);

	function replaceHtml(instance: LexicalEditor, html: string): void {
		instance.update(
			() => {
				const document = new DOMParser().parseFromString(html, 'text/html');
				const root = $getRoot();
				root.clear();
				root.append(...$generateNodesFromDOM(instance, document));
				lastGeneratedHtml = $generateHtmlFromNodes(instance);
			},
			{ tag: EXTERNAL_VALUE_TAG },
		);
	}

	onSettled(() => {
		if (!rootElement) return;

		const instance = createEditor({
			namespace: 'YahAdminRichText',
			nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
			onError: (error) => console.error('[RichTextEditor]', error),
			theme: {
				text: { bold: 'compat-editor-bold' },
			},
		});
		editor = instance;
		instance.setRootElement(rootElement);
		instance.setEditable(!props.disabled);
		const unregisterRichText = registerRichText(instance);
		const unregisterList = registerList(instance);

		if (lastParentValue) replaceHtml(instance, lastParentValue);
		const unregisterUpdates = instance.registerUpdateListener(({ editorState, tags }) => {
			// eslint-disable-next-line solid/reactivity -- Lexical invokes this callback inside its own editor-state read scope.
			editorState.read(() => {
				const selection = $getSelection();
				setIsBold($isRangeSelection(selection) && selection.hasFormat('bold'));
				const html = $generateHtmlFromNodes(instance);
				if (html === lastGeneratedHtml) return;

				lastGeneratedHtml = html;
				if (!tags.has(EXTERNAL_VALUE_TAG) && !untrack(() => props.disabled)) {
					lastEmittedValue = html;
					untrack(() => props.onChange)?.(html);
				}
			});
		});
		setReady(true);

		return () => {
			setReady(false);
			unregisterUpdates();
			unregisterList();
			unregisterRichText();
			instance.setRootElement(null);
			if (editor === instance) editor = undefined;
		};
	});

	createEffect(
		() => ({ disabled: !!props.disabled, ready: ready() }),
		(state) => {
			if (state.ready) editor?.setEditable(!state.disabled);
		},
	);

	createEffect(
		() => ({ ready: ready(), value: props.value ?? '' }),
		(state) => {
			if (!state.ready || !editor) return;
			if (state.value === lastEmittedValue) {
				lastParentValue = state.value;
				lastEmittedValue = undefined;
				return;
			}
			if (state.value === lastParentValue) return;

			lastEmittedValue = undefined;
			lastParentValue = state.value;
			replaceHtml(editor, state.value);
		},
	);

	function toggleBold(): void {
		if (!ready() || props.disabled || !editor) return;
		editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
		editor.focus();
	}

	return (
		<div class="compat-editor">
			<div class="compat-editor-toolbar" role="toolbar" aria-label={`${props.label} formatting`}>
				<button type="button" disabled={!ready() || props.disabled} aria-pressed={isBold() ? 'true' : 'false'} onClick={toggleBold}>
					Bold
				</button>
			</div>
			<div
				ref={(element) => {
					rootElement = element;
				}}
				class="compat-editor-input"
				role="textbox"
				aria-label={props.label}
				aria-multiline="true"
				aria-disabled={props.disabled ? 'true' : undefined}
				aria-busy={ready() ? undefined : 'true'}
				contenteditable={ready() && !props.disabled}
				spellcheck={true}
			/>
		</div>
	);
}
