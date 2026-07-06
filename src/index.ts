/** Root barrel: the full PowerPoint-clone engine and UI. */

export * from './core/types';
export * from './core/defaults';
export * from './core/util';
export * from './model';
export * from './shapes';
export * from './text';
export * from './style';
// Both model and style export getLayout/getMaster lookups; the style versions
// (used by rendering/inheritance) win at the root barrel.
export { getLayout, getMaster } from './style';
export * from './tables';
export * from './charts';
export * from './animation';
export * from './slideshow';
export * from './commands';
export * from './render';
export * from './export';
export * from './ui';
