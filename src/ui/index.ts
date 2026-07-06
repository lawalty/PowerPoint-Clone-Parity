/**
 * Interactive editor UI: editor state, canvas, ribbon toolbar, slide panel,
 * shared element DOM rendering, and the application shell.
 */

export { EditorState } from './state';
export type { EditorEvent, ReorderDirection, TextToggleKey } from './state';

export { Canvas, HANDLE_NAMES } from './canvas';
export type { HandleName } from './canvas';

export { Toolbar, TOOLBAR_TABS } from './toolbar';
export type { ToolbarTabId } from './toolbar';

export { SlidePanel } from './slide-panel';

export {
  applyTransformStyles,
  renderElementDiv,
  schemeForSlide,
  slideBodyTexts,
  slideTitleText,
} from './element-dom';

export { createApp } from './app';
export type { App, CreateAppOptions } from './app';
