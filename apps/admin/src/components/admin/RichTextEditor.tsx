import { type Component, createSignal, onMount, onCleanup } from 'solid-js';
import { Popover as KobaltePopover } from '@kobalte/core/popover';
import { Input } from './Input';
import { Button } from './Button';
import './RichTextEditor.css';

type RichTextEditorProps = {
	value?: string;
	onChange?: (html: string) => void;
	disabled?: boolean;
};

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

	onMount(async () => {
		[lex, rt, htmlMod, , lnk, sel] = await Promise.all([
			import('lexical'),
			import('@lexical/rich-text'),
			import('@lexical/html'),
			import('@lexical/list').then((list) => {
				INSERT_UL = list.INSERT_UNORDERED_LIST_COMMAND;
				INSERT_OL = list.INSERT_ORDERED_LIST_COMMAND;
				return list;
			}),
			import('@lexical/link'),
			import('@lexical/selection'),
		]);

		const list = await import('@lexical/list');
		FORMAT_TEXT = lex.FORMAT_TEXT_COMMAND;
		TOGGLE_LINK = lnk.TOGGLE_LINK_COMMAND;

		editorInstance = lex.createEditor({
			namespace: 'RichTextEditor',
			nodes: [
				rt.HeadingNode, rt.QuoteNode,
				list.ListNode, list.ListItemNode,
				lnk.LinkNode, lnk.AutoLinkNode,
			],
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

		editorInstance.setRootElement(editorRef!);
		rt.registerRichText(editorInstance);
		list.registerList(editorInstance);

		if (props.value) {
			editorInstance.update(() => {
				const parser = new DOMParser();
				const dom = parser.parseFromString(props.value!, 'text/html');
				const nodes = htmlMod.$generateNodesFromDOM(editorInstance, dom);
				const root = lex.$getRoot();
				root.clear();
				root.append(...nodes);
			});
		}

		editorInstance.registerUpdateListener(({ editorState }: any) => {
			editorState.read(() => {
				const selection = lex.$getSelection();
				if (lex.$isRangeSelection(selection)) {
					setIsBold(selection.hasFormat('bold'));
					setIsItalic(selection.hasFormat('italic'));
					setIsUnderline(selection.hasFormat('underline'));
					setIsStrikethrough(selection.hasFormat('strikethrough'));

					const anchorNode = selection.anchor.getNode();
					const element = anchorNode.getKey() === 'root'
						? anchorNode
						: anchorNode.getTopLevelElementOrThrow();

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
				const h = htmlMod.$generateHtmlFromNodes(editorInstance);
				props.onChange?.(h);
			});
		});

		setReady(true);
	});

	onCleanup(() => {
		editorInstance?.setRootElement(null);
	});

	function formatText(format: 'bold' | 'italic' | 'underline' | 'strikethrough') {
		editorInstance.dispatchCommand(FORMAT_TEXT, format);
	}

	function formatHeading(tag: 'h1' | 'h2' | 'h3') {
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
		editorInstance.dispatchCommand(type === 'bullet' ? INSERT_UL : INSERT_OL, undefined);
	}

	function toggleLink() {
		if (linkActive()) {
			editorInstance.dispatchCommand(TOGGLE_LINK, null);
		} else {
			setLinkUrl('');
			setLinkPopoverOpen(true);
			requestAnimationFrame(() => linkInputRef?.focus());
		}
	}

	function applyLink() {
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
			<div class={`rte-toolbar${!ready() ? ' rte-toolbar--disabled' : ''}`}>
				<div class="rte-toolbar-group">
					<button type="button" class={`rte-btn${isBold() ? ' active' : ''}`} onClick={() => formatText('bold')} title="Bold" disabled={!ready()}><strong>B</strong></button>
					<button type="button" class={`rte-btn${isItalic() ? ' active' : ''}`} onClick={() => formatText('italic')} title="Italic" disabled={!ready()}><em>I</em></button>
					<button type="button" class={`rte-btn${isUnderline() ? ' active' : ''}`} onClick={() => formatText('underline')} title="Underline" disabled={!ready()}><u>U</u></button>
					<button type="button" class={`rte-btn${isStrikethrough() ? ' active' : ''}`} onClick={() => formatText('strikethrough')} title="Strikethrough" disabled={!ready()}><s>S</s></button>
				</div>

				<div class="rte-toolbar-divider" />

				<div class="rte-toolbar-group">
					<button type="button" class={`rte-btn${blockType() === 'h1' ? ' active' : ''}`} onClick={() => formatHeading('h1')} title="Heading 1" disabled={!ready()}>H1</button>
					<button type="button" class={`rte-btn${blockType() === 'h2' ? ' active' : ''}`} onClick={() => formatHeading('h2')} title="Heading 2" disabled={!ready()}>H2</button>
					<button type="button" class={`rte-btn${blockType() === 'h3' ? ' active' : ''}`} onClick={() => formatHeading('h3')} title="Heading 3" disabled={!ready()}>H3</button>
				</div>

				<div class="rte-toolbar-divider" />

				<div class="rte-toolbar-group">
					<button type="button" class="rte-btn" onClick={() => insertList('bullet')} title="Bullet List" disabled={!ready()}>•</button>
					<button type="button" class="rte-btn" onClick={() => insertList('number')} title="Numbered List" disabled={!ready()}>1.</button>
					<button type="button" class={`rte-btn${blockType() === 'quote' ? ' active' : ''}`} onClick={() => formatQuote()} title="Blockquote" disabled={!ready()}>"</button>
				</div>

				<div class="rte-toolbar-divider" />

				<div class="rte-toolbar-group rte-link-group">
					<KobaltePopover open={linkPopoverOpen()} onOpenChange={setLinkPopoverOpen}>
						<button
							type="button"
							class={`rte-btn${linkActive() ? ' active' : ''}`}
							onClick={() => toggleLink()}
							title="Link"
							disabled={!ready()}
						>
							🔗
						</button>
						<KobaltePopover.Portal>
							<KobaltePopover.Content class="rte-link-popover" onOpenAutoFocus={(e) => { e.preventDefault(); requestAnimationFrame(() => linkInputRef?.focus()); }}>
								<form
									class="rte-link-form"
									onSubmit={(e) => { e.preventDefault(); applyLink(); }}
								>
									<Input
										ref={linkInputRef!}
										type="url"
										value={linkUrl()}
										onInput={(e) => setLinkUrl(e.currentTarget.value)}
										onKeyDown={handleLinkKeyDown}
										placeholder="https://..."
										class="rte-link-input"
									/>
									<Button type="submit">Apply</Button>
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
