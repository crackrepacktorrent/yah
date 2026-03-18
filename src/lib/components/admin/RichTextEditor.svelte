<script lang="ts">
	import { onMount } from 'svelte';

	let {
		value = '',
		onchange,
	}: {
		value?: string;
		onchange?: (html: string) => void;
	} = $props();

	let editorRef: HTMLDivElement;
	let isBold = $state(false);
	let isItalic = $state(false);
	let isUnderline = $state(false);
	let isStrikethrough = $state(false);
	let blockType = $state('paragraph');
	let linkActive = $state(false);
	let ready = $state(false);

	// Hold references populated in onMount
	let editorInstance: any;
	let FORMAT_TEXT: any;
	let INSERT_UL: any;
	let INSERT_OL: any;
	let TOGGLE_LINK: any;
	let lex: any;
	let rt: any;
	let html: any;
	let sel: any;
	let lnk: any;

	onMount(async () => {
		lex = await import('lexical');
		rt = await import('@lexical/rich-text');
		html = await import('@lexical/html');
		const list = await import('@lexical/list');
		lnk = await import('@lexical/link');
		sel = await import('@lexical/selection');

		FORMAT_TEXT = lex.FORMAT_TEXT_COMMAND;
		INSERT_UL = list.INSERT_UNORDERED_LIST_COMMAND;
		INSERT_OL = list.INSERT_ORDERED_LIST_COMMAND;
		TOGGLE_LINK = lnk.TOGGLE_LINK_COMMAND;

		editorInstance = lex.createEditor({
			namespace: 'RichTextEditor',
			nodes: [rt.HeadingNode, rt.QuoteNode, list.ListNode, list.ListItemNode, lnk.LinkNode, lnk.AutoLinkNode],
			onError: (error: Error) => console.error('[RichTextEditor]', error),
			theme: {
				text: {
					bold: 'rte-bold',
					italic: 'rte-italic',
					underline: 'rte-underline',
					strikethrough: 'rte-strikethrough',
					code: 'rte-code',
				},
				heading: { h1: 'rte-h1', h2: 'rte-h2', h3: 'rte-h3' },
				list: { ul: 'rte-ul', ol: 'rte-ol', listitem: 'rte-li' },
				quote: 'rte-blockquote',
				link: 'rte-link',
			},
		});

		editorInstance.setRootElement(editorRef);
		rt.registerRichText(editorInstance);
		list.registerList(editorInstance);

		if (value) {
			editorInstance.update(() => {
				const parser = new DOMParser();
				const dom = parser.parseFromString(value, 'text/html');
				const nodes = html.$generateNodesFromDOM(editorInstance, dom);
				const root = lex.$getRoot();
				root.clear();
				root.append(...nodes);
			});
		}

		editorInstance.registerUpdateListener(({ editorState }: any) => {
			editorState.read(() => {
				const selection = lex.$getSelection();
				if (lex.$isRangeSelection(selection)) {
					isBold = selection.hasFormat('bold');
					isItalic = selection.hasFormat('italic');
					isUnderline = selection.hasFormat('underline');
					isStrikethrough = selection.hasFormat('strikethrough');

					const anchorNode = selection.anchor.getNode();
					const element = anchorNode.getKey() === 'root'
						? anchorNode
						: anchorNode.getTopLevelElementOrThrow();

					if (rt.$isHeadingNode(element)) {
						blockType = element.getTag();
					} else if (element.getType() === 'quote') {
						blockType = 'quote';
					} else {
						blockType = element.getType();
					}

					const parent = anchorNode.getParent();
					linkActive = lnk.$isLinkNode(parent) || lnk.$isLinkNode(anchorNode);
				}
			});

			editorState.read(() => {
				const h = html.$generateHtmlFromNodes(editorInstance);
				onchange?.(h);
			});
		});

		ready = true;
	});

	function formatText(format: 'bold' | 'italic' | 'underline' | 'strikethrough') {
		editorInstance.dispatchCommand(FORMAT_TEXT, format);
	}

	function formatHeading(tag: 'h1' | 'h2' | 'h3') {
		editorInstance.update(() => {
			const selection = lex.$getSelection();
			if (lex.$isRangeSelection(selection)) {
				if (blockType === tag) {
					sel.$setBlocksType(selection, () => lex.$createParagraphNode());
				} else {
					sel.$setBlocksType(selection, () => rt.$createHeadingNode(tag));
				}
			}
		});
	}

	function formatQuote() {
		editorInstance.update(() => {
			const selection = lex.$getSelection();
			if (lex.$isRangeSelection(selection)) {
				if (blockType === 'quote') {
					sel.$setBlocksType(selection, () => lex.$createParagraphNode());
				} else {
					sel.$setBlocksType(selection, () => rt.$createQuoteNode());
				}
			}
		});
	}

	function insertList(type: 'bullet' | 'number') {
		if (type === 'bullet') {
			editorInstance.dispatchCommand(INSERT_UL, undefined);
		} else {
			editorInstance.dispatchCommand(INSERT_OL, undefined);
		}
	}

	function toggleLink() {
		if (linkActive) {
			editorInstance.dispatchCommand(TOGGLE_LINK, null);
		} else {
			const url = prompt('Enter URL:');
			if (url) {
				editorInstance.dispatchCommand(TOGGLE_LINK, url);
			}
		}
	}
</script>

<div class="rte-container">
	<div class="rte-toolbar" class:disabled={!ready}>
		<div class="rte-toolbar-group">
			<button type="button" class="rte-btn" class:active={isBold} onclick={() => formatText('bold')} title="Bold" disabled={!ready}>
				<strong>B</strong>
			</button>
			<button type="button" class="rte-btn" class:active={isItalic} onclick={() => formatText('italic')} title="Italic" disabled={!ready}>
				<em>I</em>
			</button>
			<button type="button" class="rte-btn" class:active={isUnderline} onclick={() => formatText('underline')} title="Underline" disabled={!ready}>
				<u>U</u>
			</button>
			<button type="button" class="rte-btn" class:active={isStrikethrough} onclick={() => formatText('strikethrough')} title="Strikethrough" disabled={!ready}>
				<s>S</s>
			</button>
		</div>

		<div class="rte-toolbar-divider"></div>

		<div class="rte-toolbar-group">
			<button type="button" class="rte-btn" class:active={blockType === 'h1'} onclick={() => formatHeading('h1')} title="Heading 1" disabled={!ready}>H1</button>
			<button type="button" class="rte-btn" class:active={blockType === 'h2'} onclick={() => formatHeading('h2')} title="Heading 2" disabled={!ready}>H2</button>
			<button type="button" class="rte-btn" class:active={blockType === 'h3'} onclick={() => formatHeading('h3')} title="Heading 3" disabled={!ready}>H3</button>
		</div>

		<div class="rte-toolbar-divider"></div>

		<div class="rte-toolbar-group">
			<button type="button" class="rte-btn" onclick={() => insertList('bullet')} title="Bullet List" disabled={!ready}>&bull;</button>
			<button type="button" class="rte-btn" onclick={() => insertList('number')} title="Numbered List" disabled={!ready}>1.</button>
			<button type="button" class="rte-btn" class:active={blockType === 'quote'} onclick={() => formatQuote()} title="Blockquote" disabled={!ready}>&ldquo;</button>
		</div>

		<div class="rte-toolbar-divider"></div>

		<div class="rte-toolbar-group">
			<button type="button" class="rte-btn" class:active={linkActive} onclick={() => toggleLink()} title="Link" disabled={!ready}>&#128279;</button>
		</div>
	</div>

	<div class="rte-editor" contenteditable="true" bind:this={editorRef}></div>
</div>

<style>
	.rte-container {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--color-surface);
	}

	.rte-toolbar {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.5rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-page-bg);
		flex-wrap: wrap;
	}

	.rte-toolbar.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.rte-toolbar-group {
		display: flex;
		gap: 0.125rem;
	}

	.rte-toolbar-divider {
		width: 1px;
		height: 1.25rem;
		background: var(--color-border);
		margin: 0 0.25rem;
	}

	.rte-btn {
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.8rem;
		padding: 0.25rem 0.5rem;
		min-width: 1.75rem;
		text-align: center;
		line-height: 1;
		transition: all 0.1s ease;
	}

	.rte-btn:hover:not(:disabled) {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	.rte-btn.active {
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		border-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.rte-editor {
		min-height: 200px;
		padding: 0.75rem 1rem;
		outline: none;
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--color-foreground);
	}

	.rte-editor:focus {
		box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 15%, transparent);
	}

	:global(.rte-bold) { font-weight: 700; }
	:global(.rte-italic) { font-style: italic; }
	:global(.rte-underline) { text-decoration: underline; }
	:global(.rte-strikethrough) { text-decoration: line-through; }
	:global(.rte-code) {
		font-family: monospace;
		background: var(--color-hover);
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.85em;
	}

	:global(.rte-h1) { font-size: 1.75rem; font-weight: 700; margin: 0.5rem 0; }
	:global(.rte-h2) { font-size: 1.375rem; font-weight: 700; margin: 0.4rem 0; }
	:global(.rte-h3) { font-size: 1.125rem; font-weight: 700; margin: 0.3rem 0; }

	:global(.rte-ul) { list-style: disc; padding-left: 1.5rem; margin: 0.25rem 0; }
	:global(.rte-ol) { list-style: decimal; padding-left: 1.5rem; margin: 0.25rem 0; }
	:global(.rte-li) { margin: 0.125rem 0; }

	:global(.rte-blockquote) {
		border-left: 3px solid var(--color-border);
		padding-left: 1rem;
		color: var(--color-muted);
		margin: 0.5rem 0;
	}

	:global(.rte-link) {
		color: var(--color-primary);
		text-decoration: underline;
	}
</style>
