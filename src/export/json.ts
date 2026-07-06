/**
 * JSON export/import: thin delegation to the model's lossless serializer.
 */

import type { Presentation } from '../core/types';
import { deserializePresentation, serializePresentation } from '../model';

/** Serialize a presentation to its canonical JSON form. */
export function exportJSON(pres: Presentation): string {
  return serializePresentation(pres);
}

/** Parse and validate a presentation JSON string. */
export const importJSON: (json: string) => Presentation = deserializePresentation;
