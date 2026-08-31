// eslint-disable-next-line solid/imports -- Solid 2 intrinsic JSX types are renderer-owned.
import type { JSX } from '@solidjs/web';
import { Show, createUniqueId, omit, type Element as SolidElement, type ParentProps } from 'solid-js';

type FieldProps = {
	label: SolidElement;
	help?: SolidElement;
	fieldClass?: string;
};

function stringAttribute(value: string | false | undefined): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function describedBy(existing: string | false | undefined, help: SolidElement | undefined, helpId: string): string | undefined {
	return [stringAttribute(existing), help ? helpId : undefined].filter(Boolean).join(' ') || undefined;
}

function FieldFrame(props: ParentProps<FieldProps & { controlId: string; helpId: string }>) {
	return (
		<div class={props.fieldClass ? `form-field ${props.fieldClass}` : 'form-field'}>
			<label for={props.controlId}>{props.label}</label>
			{props.children}
			<Show when={props.help}>{(help) => <small id={props.helpId}>{help()}</small>}</Show>
		</div>
	);
}

export type InputFieldProps = FieldProps & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'children'>;

export function InputField(props: InputFieldProps) {
	const generatedId = createUniqueId();
	const input = omit(props, 'label', 'help', 'fieldClass', 'id', 'aria-describedby');
	const controlId = () => stringAttribute(props.id) ?? `field-${generatedId}`;
	const helpId = () => `${controlId()}-help`;
	return (
		<FieldFrame label={props.label} help={props.help} fieldClass={props.fieldClass} controlId={controlId()} helpId={helpId()}>
			<input {...input} id={controlId()} aria-describedby={describedBy(props['aria-describedby'], props.help, helpId())} />
		</FieldFrame>
	);
}

export type SelectFieldProps = FieldProps & JSX.SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField(props: SelectFieldProps) {
	const generatedId = createUniqueId();
	const select = omit(props, 'label', 'help', 'fieldClass', 'id', 'aria-describedby', 'children');
	const controlId = () => stringAttribute(props.id) ?? `field-${generatedId}`;
	const helpId = () => `${controlId()}-help`;
	return (
		<FieldFrame label={props.label} help={props.help} fieldClass={props.fieldClass} controlId={controlId()} helpId={helpId()}>
			<select {...select} id={controlId()} aria-describedby={describedBy(props['aria-describedby'], props.help, helpId())}>{props.children}</select>
		</FieldFrame>
	);
}

export type TextareaFieldProps = FieldProps & JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextareaField(props: TextareaFieldProps) {
	const generatedId = createUniqueId();
	const textarea = omit(props, 'label', 'help', 'fieldClass', 'id', 'aria-describedby', 'children');
	const controlId = () => stringAttribute(props.id) ?? `field-${generatedId}`;
	const helpId = () => `${controlId()}-help`;
	return (
		<FieldFrame label={props.label} help={props.help} fieldClass={props.fieldClass} controlId={controlId()} helpId={helpId()}>
			<textarea {...textarea} id={controlId()} aria-describedby={describedBy(props['aria-describedby'], props.help, helpId())}>{props.children}</textarea>
		</FieldFrame>
	);
}
