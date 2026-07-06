/**
 * Document properties.
 */

import type { DocumentProperties, Presentation } from '../core/types';

/** Fields callers may patch directly; revision/modifiedAt are managed here. */
export type PropertiesPatch = Partial<Omit<DocumentProperties, 'revision' | 'modifiedAt'>>;

/**
 * Apply a patch to the document properties, bumping the revision counter and
 * stamping modifiedAt from the injectable clock (deterministic in tests).
 */
export function updateProperties(
  pres: Presentation,
  patch: PropertiesPatch,
  now: () => number = Date.now,
): DocumentProperties {
  Object.assign(pres.properties, patch);
  pres.properties.revision += 1;
  pres.properties.modifiedAt = now();
  return pres.properties;
}
