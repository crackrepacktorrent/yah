import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { $isLinkNode, $toggleLink, AutoLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode, registerList } from '@lexical/list';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import {
	$createParagraphNode,
	$getRoot,
	$getSelection,
	$isRangeSelection,
	$setSelection,
	createEditor,
	FORMAT_TEXT_COMMAND,
	type LexicalEditor,
	type RangeSelection,
} from 'lexical';
import { Show, createEffect, createSignal, onSettled, untrack } from 'solid-js';
import './rich-text-editor.css';

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
	let savedLinkSelection: RangeSelection | null = null;
	const [ready, setReady] = createSignal(false);
	const [isBold, setIsBold] = createSignal(false);
	const [isItalic, setIsItalic] = createSignal(false);
	const [isUnderline, setIsUnderline] = createSignal(false);
	const [isStrikethrough, setIsStrikethrough] = createSignal(false);
	const [blockType, setBlockType] = createSignal('paragraph');
	const [linkActive, setLinkActive] = createSignal(false);
	const [linkEditorOpen, setLinkEditorOpen] = createSignal(false);
	const [linkUrl, setLinkUrl] = createSignal('');
	const [linkError, setLinkError] = createSignal('');

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
			nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode],
			onError: (error) => console.error('[RichTextEditor]', error),
			theme: {
				text: {
					bold: 'rich-text-editor-bold',
					italic: 'rich-text-editor-italic',
					underline: 'rich-text-editor-underline',
					strikethrough: 'rich-text-editor-strikethrough',
				},
				heading: { h1: 'rich-text-editor-h1', h2: 'rich-text-editor-h2', h3: 'rich-text-editor-h3' },
				list: { ul: 'rich-text-editor-ul', ol: 'rich-text-editor-ol', listitem: 'rich-text-editor-li' },
				quote: 'rich-text-editor-quote',
				link: 'rich-text-editor-link',
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
				if ($isRangeSelection(selection)) {
					setIsBold(selection.hasFormat('bold'));
					setIsItalic(selection.hasFormat('italic'));
					setIsUnderline(selection.hasFormat('underline'));
					setIsStrikethrough(selection.hasFormat('strikethrough'));
					const anchor = selection.anchor.getNode();
					const element = anchor.getKey() === 'root' ? anchor : anchor.getTopLevelElementOrThrow();
					if ($isHeadingNode(element)) setBlockType(element.getTag());
					else if ($isQuoteNode(element)) setBlockType('quote');
					else if ($isListNode(element)) setBlockType(element.getListType());
					else setBlockType(element.getType());
					setLinkActive($isLinkNode(anchor) || $isLinkNode(anchor.getParent()));
				}
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
			if (state.disabled) setLinkEditorOpen(false);
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

	function formatText(format: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
		if (!ready() || props.disabled || !editor) return;
		editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
		editor.focus();
	}

	function formatHeading(tag: 'h1' | 'h2' | 'h3'): void {
		if (!ready() || props.disabled || !editor) return;
		const active = blockType() === tag;
		editor.update(() => {
			const selection = $getSelection();
			if ($isRangeSelection(selection)) $setBlocksType(selection, () => active ? $createParagraphNode() : $createHeadingNode(tag));
		});
		editor.focus();
	}

	function formatQuote(): void {
		if (!ready() || props.disabled || !editor) return;
		const active = blockType() === 'quote';
		editor.update(() => {
			const selection = $getSelection();
			if ($isRangeSelection(selection)) $setBlocksType(selection, () => active ? $createParagraphNode() : $createQuoteNode());
		});
		editor.focus();
	}

	function insertList(type: 'bullet' | 'number'): void {
		if (!ready() || props.disabled || !editor) return;
		editor.dispatchCommand(type === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined);
		editor.focus();
	}

	function editLink(): void {
		if (!ready() || props.disabled || !editor) return;
		if (linkActive()) {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
			editor.focus();
			return;
		}
		editor.getEditorState().read(() => {
			const selection = $getSelection();
			savedLinkSelection = $isRangeSelection(selection) ? selection.clone() : null;
		});
		setLinkError('');
		setLinkUrl('');
		setLinkEditorOpen(true);
	}

	function normalizedLinkUrl(value: string): string | null {
		const input = value.trim();
		try {
			const url = new URL(input);
			return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.toString() : null;
		} catch {
			return null;
		}
	}

	function applyLink(): void {
		if (!editor) return;
		const url = normalizedLinkUrl(linkUrl());
		if (!url) {
			setLinkError('Enter an http, https, or mailto URL.');
			return;
		}
		editor.update(() => {
			if (savedLinkSelection) $setSelection(savedLinkSelection.clone());
			$toggleLink(url);
		});
		savedLinkSelection = null;
		setLinkEditorOpen(false);
		setLinkError('');
		editor.focus();
	}

	return (
		<div class="rich-text-editor">
			<div class="rich-text-editor-toolbar" role="toolbar" aria-label={`${props.label} formatting`} onPointerDown={(event) => { if (event.target instanceof Element && event.target.closest('button')) event.preventDefault(); }}>
				<div class="rich-text-editor-toolbar-group">
					<button type="button" disabled={!ready() || props.disabled} aria-label="Bold" aria-pressed={isBold() ? 'true' : 'false'} onClick={() => formatText('bold')}><strong>B</strong></button>
					<button type="button" disabled={!ready() || props.disabled} aria-label="Italic" aria-pressed={isItalic() ? 'true' : 'false'} onClick={() => formatText('italic')}><em>I</em></button>
					<button type="button" disabled={!ready() || props.disabled} aria-label="Underline" aria-pressed={isUnderline() ? 'true' : 'false'} onClick={() => formatText('underline')}><u>U</u></button>
					<button type="button" disabled={!ready() || props.disabled} aria-label="Strikethrough" aria-pressed={isStrikethrough() ? 'true' : 'false'} onClick={() => formatText('strikethrough')}><s>S</s></button>
				</div>
				<span class="rich-text-editor-toolbar-divider" aria-hidden="true" />
				<div class="rich-text-editor-toolbar-group">
					<button type="button" disabled={!ready() || props.disabled} aria-label="Heading 1" aria-pressed={blockType() === 'h1' ? 'true' : 'false'} onClick={() => formatHeading('h1')}>H1</button>
					<button type="button" disabled={!ready() || props.disabled} aria-label="Heading 2" aria-pressed={blockType() === 'h2' ? 'true' : 'false'} onClick={() => formatHeading('h2')}>H2</button>
					<button type="button" disabled={!ready() || props.disabled} aria-label="Heading 3" aria-pressed={blockType() === 'h3' ? 'true' : 'false'} onClick={() => formatHeading('h3')}>H3</button>
				</div>
				<span class="rich-text-editor-toolbar-divider" aria-hidden="true" />
				<div class="rich-text-editor-toolbar-group">
					<button type="button" disabled={!ready() || props.disabled} aria-label="Bulleted list" aria-pressed={blockType() === 'bullet' ? 'true' : 'false'} onClick={() => insertList('bullet')}>• List</button>
					<button type="button" disabled={!ready() || props.disabled} aria-label="Numbered list" aria-pressed={blockType() === 'number' ? 'true' : 'false'} onClick={() => insertList('number')}>1. List</button>
					<button type="button" disabled={!ready() || props.disabled} aria-label="Block quote" aria-pressed={blockType() === 'quote' ? 'true' : 'false'} onClick={formatQuote}>Quote</button>
				</div>
				<span class="rich-text-editor-toolbar-divider" aria-hidden="true" />
				<button type="button" disabled={!ready() || props.disabled} aria-label={linkActive() ? 'Remove link' : 'Add link'} aria-pressed={linkActive() ? 'true' : 'false'} onClick={editLink}>{linkActive() ? 'Unlink' : 'Link'}</button>
			</div>
			<Show when={linkEditorOpen()}>
				<form class="rich-text-editor-link-form" onSubmit={(event) => { event.preventDefault(); applyLink(); }}>
					<label><span>Link URL</span><input type="url" value={linkUrl()} placeholder="https://example.org" required onInput={(event) => { setLinkUrl(event.currentTarget.value); setLinkError(''); }} /></label>
					<button type="submit">Apply link</button>
					<button type="button" onClick={() => { setLinkEditorOpen(false); setLinkError(''); editor?.focus(); }}>Cancel</button>
					<Show when={linkError()}>{(message) => <span class="field-error" role="alert">{message()}</span>}</Show>
				</form>
			</Show>
			<div
				ref={(element) => {
					rootElement = element;
				}}
				class="rich-text-editor-input"
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
