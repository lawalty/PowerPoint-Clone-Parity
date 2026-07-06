/**
 * JSON serialization with structural validation. Round-trips are lossless
 * because the model is plain serializable data.
 */

import type { Id, Presentation, SlideElement } from '../core/types';

/** Serialize a presentation to a JSON string. */
export function serializePresentation(pres: Presentation): string {
  return JSON.stringify(pres);
}

function fail(message: string): never {
  throw new Error(`Invalid presentation: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireArray(data: Record<string, unknown>, key: string): unknown[] {
  const value = data[key];
  if (!Array.isArray(value)) fail(`"${key}" must be an array`);
  return value;
}

function collectElementIds(elements: SlideElement[], where: string, register: (id: Id, where: string) => void): void {
  for (const el of elements) {
    if (!isObject(el) || typeof el.id !== 'string') fail(`element without a string id in ${where}`);
    register(el.id, where);
    if (el.type === 'group' && Array.isArray(el.children)) {
      collectElementIds(el.children, where, register);
    }
  }
}

/**
 * Parse and validate a serialized presentation. Throws a descriptive Error
 * on malformed JSON, wrong formatVersion, missing/invalid collections,
 * dangling references (layoutId, masterId, themeId, section slideIds,
 * defaultMasterId) or duplicate ids.
 */
export function deserializePresentation(json: string): Presentation {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (err) {
    fail(`not valid JSON (${(err as Error).message})`);
  }

  if (!isObject(data)) fail('root must be an object');
  if (typeof data.id !== 'string' || data.id.length === 0) fail('"id" must be a non-empty string');
  if (data.formatVersion !== 1) fail(`unsupported formatVersion ${JSON.stringify(data.formatVersion)}, expected 1`);
  if (!isObject(data.properties)) fail('"properties" must be an object');
  if (!isObject(data.slideSize) || typeof data.slideSize.width !== 'number' || typeof data.slideSize.height !== 'number') {
    fail('"slideSize" must be an object with numeric width and height');
  }

  const slides = requireArray(data, 'slides');
  const sections = requireArray(data, 'sections');
  const masters = requireArray(data, 'masters');
  const layouts = requireArray(data, 'layouts');
  const themes = requireArray(data, 'themes');

  // --- Duplicate id detection across every identified entity ---------------
  const seen = new Map<Id, string>();
  const register = (id: Id, where: string): void => {
    const existing = seen.get(id);
    if (existing !== undefined) fail(`duplicate id "${id}" (${existing} and ${where})`);
    seen.set(id, where);
  };

  const themeIds = new Set<Id>();
  for (const theme of themes) {
    if (!isObject(theme) || typeof theme.id !== 'string') fail('theme without a string id');
    register(theme.id, 'theme');
    themeIds.add(theme.id);
  }

  const masterIds = new Set<Id>();
  for (const master of masters) {
    if (!isObject(master) || typeof master.id !== 'string') fail('master without a string id');
    register(master.id, 'master');
    masterIds.add(master.id);
  }

  const layoutIds = new Set<Id>();
  for (const layout of layouts) {
    if (!isObject(layout) || typeof layout.id !== 'string') fail('layout without a string id');
    register(layout.id, 'layout');
    layoutIds.add(layout.id);
  }

  const slideIds = new Set<Id>();
  for (const slide of slides) {
    if (!isObject(slide) || typeof slide.id !== 'string') fail('slide without a string id');
    register(slide.id, 'slide');
    slideIds.add(slide.id);
  }

  for (const section of sections) {
    if (!isObject(section) || typeof section.id !== 'string') fail('section without a string id');
    register(section.id, 'section');
    if (!Array.isArray(section.slideIds)) fail(`section "${section.id}" must have a slideIds array`);
  }

  for (const slide of slides as Array<Record<string, unknown>>) {
    if (Array.isArray(slide.elements)) {
      collectElementIds(slide.elements as SlideElement[], `slide "${slide.id}"`, register);
    }
  }
  for (const layout of layouts as Array<Record<string, unknown>>) {
    if (Array.isArray(layout.elements)) {
      collectElementIds(layout.elements as SlideElement[], `layout "${layout.id}"`, register);
    }
  }
  for (const master of masters as Array<Record<string, unknown>>) {
    if (Array.isArray(master.elements)) {
      collectElementIds(master.elements as SlideElement[], `master "${master.id}"`, register);
    }
  }

  // --- Reference integrity --------------------------------------------------
  for (const slide of slides as Array<Record<string, unknown>>) {
    if (typeof slide.layoutId !== 'string' || !layoutIds.has(slide.layoutId)) {
      fail(`slide "${slide.id}" references missing layout "${String(slide.layoutId)}"`);
    }
  }
  for (const layout of layouts as Array<Record<string, unknown>>) {
    if (typeof layout.masterId !== 'string' || !masterIds.has(layout.masterId)) {
      fail(`layout "${layout.id}" references missing master "${String(layout.masterId)}"`);
    }
  }
  for (const master of masters as Array<Record<string, unknown>>) {
    if (typeof master.themeId !== 'string' || !themeIds.has(master.themeId)) {
      fail(`master "${master.id}" references missing theme "${String(master.themeId)}"`);
    }
    if (Array.isArray(master.layoutIds)) {
      for (const layoutId of master.layoutIds) {
        if (typeof layoutId !== 'string' || !layoutIds.has(layoutId)) {
          fail(`master "${master.id}" references missing layout "${String(layoutId)}"`);
        }
      }
    }
  }
  const sectionSlideIds = new Set<Id>();
  for (const section of sections as Array<Record<string, unknown>>) {
    for (const slideId of section.slideIds as unknown[]) {
      if (typeof slideId !== 'string' || !slideIds.has(slideId)) {
        fail(`section "${section.id}" references missing slide "${String(slideId)}"`);
      }
      if (sectionSlideIds.has(slideId)) {
        fail(`slide "${slideId}" appears in more than one section`);
      }
      sectionSlideIds.add(slideId);
    }
  }
  if (typeof data.defaultMasterId !== 'string' || !masterIds.has(data.defaultMasterId)) {
    fail(`defaultMasterId "${String(data.defaultMasterId)}" references a missing master`);
  }

  return data as unknown as Presentation;
}
