import { describe, expect, test } from 'bun:test';
import {
  getEditorToken,
  lineHeightValues,
  maxWidthValues,
  paragraphSpacingValues,
  radiusValues,
  spacingValues,
  textAlignValues,
  textSizeValues
} from './editor-options';

describe('editor option tokens', () => {
  test('maps the supported typography and layout options', () => {
    expect(getEditorToken(textSizeValues, '2xl')).toBe('1.5rem');
    expect(getEditorToken(textAlignValues, 'center')).toBe('center');
    expect(getEditorToken(lineHeightValues, 'relaxed')).toBe('1.75');
    expect(getEditorToken(spacingValues, 'none')).toBe('0');
    expect(getEditorToken(paragraphSpacingValues, 'md')).toBe('var(--space-4)');
    expect(getEditorToken(maxWidthValues, 'lg')).toBe('64rem');
    expect(getEditorToken(maxWidthValues, 'full')).toBe('100%');
    expect(getEditorToken(radiusValues, 'md')).toBe('var(--radius-md)');
  });

  test('keeps default, unset, and unknown values as no-ops', () => {
    expect(getEditorToken(spacingValues, 'default')).toBeUndefined();
    expect(getEditorToken(maxWidthValues, '')).toBeUndefined();
    expect(getEditorToken(textSizeValues, undefined)).toBeUndefined();
    expect(getEditorToken(textAlignValues, 'default')).toBeUndefined();
    expect(getEditorToken(textAlignValues, 'justify')).toBeUndefined();
    expect(getEditorToken(lineHeightValues, 'unexpected')).toBeUndefined();
  });

  test('does not resolve inherited object properties as editor options', () => {
    expect(getEditorToken(spacingValues, 'toString')).toBeUndefined();
  });
});
