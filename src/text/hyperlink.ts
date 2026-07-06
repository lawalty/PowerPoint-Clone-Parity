/** Hyperlink operations. Operations mutate the body in place. */

import type { TextBody } from '../core/types';
import { mutateBodyRange } from './internal';
import type { TextPosition } from './types';

/** Apply a hyperlink exactly to [start, end), splitting runs as needed. */
export function setHyperlink(
  body: TextBody,
  start: TextPosition,
  end: TextPosition,
  url: string,
): TextBody {
  mutateBodyRange(body, start, end, (run) => {
    run.hyperlink = url;
  });
  return body;
}

/** Remove hyperlinks from [start, end), splitting runs as needed. */
export function removeHyperlink(
  body: TextBody,
  start: TextPosition,
  end: TextPosition,
): TextBody {
  mutateBodyRange(body, start, end, (run) => {
    delete run.hyperlink;
  });
  return body;
}
