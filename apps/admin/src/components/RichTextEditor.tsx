/* eslint-disable @typescript-eslint/no-explicit-any -- Lexical is dynamically imported with no static types */
/* eslint-disable solid/reactivity -- editor commands are event handlers, not reactive derivations */
import { type Component, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { Popover as KobaltePopover } from '@kobalte/core/popover';
import { Input } from './Input';
import { Button } from './Button';
import './RichTextEditor.css';

type RichTextEditorProps = {
	value?: string;
	onChange?: (html: string) => void;
	disabled?: boolean;
};

const EXTERNAL_VALUE_TAG = 'rte-external-value';

export const RichTextEditor: Component<RichTextEditorProps> = (props) => {
	let editorRef: HTMLDivElement | undefined;
	const [isBold, setIsBold] = createSignal(false);
	const [isItalic, setIsItalic] = createSignal(false);
	const [isUnderline, setIsUnderline] = createSignal(false);
	const [isStrikethrough, setIsStrikethrough] = createSignal(false);
	const [blockType, setBlockType] = createSignal('paragraph');
	const [linkActive, setLinkActive] = createSignal(false);
	const [ready, setReady] = createSignal(false);
	const [linkPopoverOpen, setLinkPopoverOpen] = createSignal(false);
	const [linkUrl, setLinkUrl] = createSignal('');
	let linkInputRef: HTMLInputElement | undefined;
	const controlsDisabled = () => !ready() || !!props.disabled;

	// Lexical instances — loaded asynchronously
	let editorInstance: any;
	let FORMAT_TEXT: any;
	let INSERT_UL: any;
	let INSERT_OL: any;
	let TOGGLE_LINK: any;
	let lex: any;
	let rt: any;
	let htmlMod: any;
	let sel: any;
	let lnk: any;
	let disposed = false;
	let lastValueFromParent = props.value ?? '';
	let lastEmittedValue: string | undefined;
	let lastGeneratedHtml = props.value ?? '';
	const unregister: Array<() => void> = [];

	function replaceEditorHtml(html: string, tag?: string) {
		editorInstance.update(
			() => {
				const parser = new DOMParser();
				const dom = parser.parseFromString(html, 'text/html');
				const nodes = htmlMod.$generateNodesFromDOM(editorInstance, dom);
				const root = lex.$getRoot();
				root.clear();
				root.append(...nodes);
				lastGeneratedHtml = htmlMod.$generateHtmlFromNodes(editorInstance);
			},
			tag ? { tag } : undefined,
		);
	}

	onMount(async () => {
		try {
			const [lexicalModule, richTextModule, htmlModule, listModule, linkModule, selectionModule] = await Promise.all([
				import('lexical'),
				import('@lexical/rich-text'),
				import('@lexical/html'),
				import('@lexical/list'),
				import('@lexical/link'),
				import('@lexical/selection'),
			]);

			if (disposed || !editorRef) return;

			lex = lexicalModule;
			rt = richTextModule;
			htmlMod = htmlModule;
			lnk = linkModule;
			sel = selectionModule;
			FORMAT_TEXT = lex.FORMAT_TEXT_COMMAND;
			INSERT_UL = listModule.INSERT_UNORDERED_LIST_COMMAND;
			INSERT_OL = listModule.INSERT_ORDERED_LIST_COMMAND;
			TOGGLE_LINK = lnk.TOGGLE_LINK_COMMAND;

			editorInstance = lex.createEditor({
				namespace: 'RichTextEditor',
				nodes: [rt.HeadingNode, rt.QuoteNode, listModule.ListNode, listModule.ListItemNode, lnk.LinkNode, lnk.AutoLinkNode],
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
			editorInstance.setEditable(!props.disabled);
			unregister.push(rt.registerRichText(editorInstance), listModule.registerList(editorInstance));

			if (props.value) replaceEditorHtml(props.value, EXTERNAL_VALUE_TAG);

			unregister.push(
				editorInstance.registerUpdateListener(({ editorState, tags }: any) => {
					editorState.read(() => {
						const selection = lex.$getSelection();
						if (lex.$isRangeSelection(selection)) {
							setIsBold(selection.hasFormat('bold'));
							setIsItalic(selection.hasFormat('italic'));
							setIsUnderline(selection.hasFormat('underline'));
							setIsStrikethrough(selection.hasFormat('strikethrough'));

							const anchorNode = selection.anchor.getNode();
							const element = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();

							if (rt.$isHeadingNode(element)) {
								setBlockType(element.getTag());
							} else if (element.getType() === 'quote') {
								setBlockType('quote');
							} else {
								setBlockType(element.getType());
							}

							const parent = anchorNode.getParent();
							setLinkActive(lnk.$isLinkNode(parent) || lnk.$isLinkNode(anchorNode));
						}
					});

					editorState.read(() => {
						const html = htmlMod.$generateHtmlFromNodes(editorInstance);
						const contentChanged = html !== lastGeneratedHtml;
						lastGeneratedHtml = html;

						if (contentChanged && !tags?.has(EXTERNAL_VALUE_TAG) && !props.disabled) {
							lastEmittedValue = html;
							props.onChange?.(html);
						}
					});
				}),
			);

			setReady(true);
		} catch (error) {
			if (!disposed) console.error('[RichTextEditor] Failed to initialize', error);
		}
	});

	onCleanup(() => {
		disposed = true;
		for (const removeListener of unregister.splice(0).reverse()) removeListener();
		editorInstance?.setRootElement(null);
		editorInstance = undefined;
	});

	createEffect(() => {
		const disabled = !!props.disabled;
		if (!ready() || !editorInstance) return;

		editorInstance.setEditable(!disabled);
		if (disabled) setLinkPopoverOpen(false);
	});

	createEffect(() => {
		const value = props.value ?? '';
		if (!ready() || !editorInstance) return;

		if (value === lastEmittedValue) {
			lastValueFromParent = value;
			lastEmittedValue = undefined;
			return;
		}
		if (value === lastValueFromParent) return;

		lastValueFromParent = value;
		replaceEditorHtml(value, EXTERNAL_VALUE_TAG);
	});

	function formatText(format: 'bold' | 'italic' | 'underline' | 'strikethrough') {
		if (controlsDisabled()) return;
		editorInstance.dispatchCommand(FORMAT_TEXT, format);
	}

	function formatHeading(tag: 'h1' | 'h2' | 'h3') {
		if (controlsDisabled()) return;
		editorInstance.update(() => {
			const selection = lex.$getSelection();
			if (lex.$isRangeSelection(selection)) {
				if (blockType() === tag) {
					sel.$setBlocksType(selection, () => lex.$createParagraphNode());
				} else {
					sel.$setBlocksType(selection, () => rt.$createHeadingNode(tag));
				}
			}
		});
	}

	function formatQuote() {
		if (controlsDisabled()) return;
		editorInstance.update(() => {
			const selection = lex.$getSelection();
			if (lex.$isRangeSelection(selection)) {
				if (blockType() === 'quote') {
					sel.$setBlocksType(selection, () => lex.$createParagraphNode());
				} else {
					sel.$setBlocksType(selection, () => rt.$createQuoteNode());
				}
			}
		});
	}

	function insertList(type: 'bullet' | 'number') {
		if (controlsDisabled()) return;
		editorInstance.dispatchCommand(type === 'bullet' ? INSERT_UL : INSERT_OL, undefined);
	}

	function toggleLink() {
		if (controlsDisabled()) return;
		if (linkActive()) {
			editorInstance.dispatchCommand(TOGGLE_LINK, null);
		} else {
			setLinkUrl('');
			setLinkPopoverOpen(true);
			requestAnimationFrame(() => linkInputRef?.focus());
		}
	}

	function applyLink() {
		if (controlsDisabled()) return;
		const url = linkUrl().trim();
		if (url) {
			editorInstance.dispatchCommand(TOGGLE_LINK, url);
		}
		setLinkPopoverOpen(false);
		editorRef?.focus();
	}

	function handleLinkKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			applyLink();
		} else if (e.key === 'Escape') {
			setLinkPopoverOpen(false);
			editorRef?.focus();
		}
	}

	return (
		<div class="rte-container">
			<div class={`rte-toolbar${controlsDisabled() ? ' rte-toolbar--disabled' : ''}`}>
				<div class="rte-toolbar-group">
					<button
						type="button"
						class={`rte-btn${isBold() ? ' active' : ''}`}
						onClick={() => formatText('bold')}
						title="Bold"
						disabled={controlsDisabled()}
					>
						<strong>B</strong>
					</button>
					<button
						type="button"
						class={`rte-btn${isItalic() ? ' active' : ''}`}
						onClick={() => formatText('italic')}
						title="Italic"
						disabled={controlsDisabled()}
					>
						<em>I</em>
					</button>
					<button
						type="button"
						class={`rte-btn${isUnderline() ? ' active' : ''}`}
						onClick={() => formatText('underline')}
						title="Underline"
						disabled={controlsDisabled()}
					>
						<u>U</u>
					</button>
					<button
						type="button"
						class={`rte-btn${isStrikethrough() ? ' active' : ''}`}
						onClick={() => formatText('strikethrough')}
						title="Strikethrough"
						disabled={controlsDisabled()}
					>
						<s>S</s>
					</button>
				</div>

				<div class="rte-toolbar-divider" />

				<div class="rte-toolbar-group">
					<button
						type="button"
						class={`rte-btn${blockType() === 'h1' ? ' active' : ''}`}
						onClick={() => formatHeading('h1')}
						title="Heading 1"
						disabled={controlsDisabled()}
					>
						H1
					</button>
					<button
						type="button"
						class={`rte-btn${blockType() === 'h2' ? ' active' : ''}`}
						onClick={() => formatHeading('h2')}
						title="Heading 2"
						disabled={controlsDisabled()}
					>
						H2
					</button>
					<button
						type="button"
						class={`rte-btn${blockType() === 'h3' ? ' active' : ''}`}
						onClick={() => formatHeading('h3')}
						title="Heading 3"
						disabled={controlsDisabled()}
					>
						H3
					</button>
				</div>

				<div class="rte-toolbar-divider" />

				<div class="rte-toolbar-group">
					<button type="button" class="rte-btn" onClick={() => insertList('bullet')} title="Bullet List" disabled={controlsDisabled()}>
						•
					</button>
					<button type="button" class="rte-btn" onClick={() => insertList('number')} title="Numbered List" disabled={controlsDisabled()}>
						1.
					</button>
					<button
						type="button"
						class={`rte-btn${blockType() === 'quote' ? ' active' : ''}`}
						onClick={() => formatQuote()}
						title="Blockquote"
						disabled={controlsDisabled()}
					>
						"
					</button>
				</div>

				<div class="rte-toolbar-divider" />

				<div class="rte-toolbar-group rte-link-group">
					<KobaltePopover open={linkPopoverOpen()} onOpenChange={(open) => setLinkPopoverOpen(controlsDisabled() ? false : open)}>
						<button
							type="button"
							class={`rte-btn${linkActive() ? ' active' : ''}`}
							onClick={() => toggleLink()}
							title="Link"
							disabled={controlsDisabled()}
						>
							🔗
						</button>
						<KobaltePopover.Portal>
							<KobaltePopover.Content
								class="rte-link-popover"
								onOpenAutoFocus={(e) => {
									e.preventDefault();
									requestAnimationFrame(() => linkInputRef?.focus());
								}}
							>
								<form
									class="rte-link-form"
									onSubmit={(e) => {
										e.preventDefault();
										applyLink();
									}}
								>
									<Input
										ref={linkInputRef!}
										type="url"
										value={linkUrl()}
										onInput={(e) => setLinkUrl(e.currentTarget.value)}
										onKeyDown={handleLinkKeyDown}
										placeholder="https://..."
										class="rte-link-input"
										disabled={controlsDisabled()}
									/>
									<Button type="submit" disabled={controlsDisabled()}>
										Apply
									</Button>
								</form>
							</KobaltePopover.Content>
						</KobaltePopover.Portal>
					</KobaltePopover>
				</div>
			</div>

			<div class="rte-editor" contenteditable={!props.disabled} ref={editorRef!} />
		</div>
	);
};
