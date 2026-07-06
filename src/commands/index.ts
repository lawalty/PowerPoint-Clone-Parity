export {
  History,
  CompositeCommand,
  TypingCommand,
  MERGE_WINDOW_MS,
} from './history';
export type { Command, HistoryOptions } from './history';

export {
  makeMutation,
  restoreInPlace,
  slideMutation,
  presentationMutation,
} from './mutate';
export type { MutationScope } from './mutate';

export {
  Clipboard,
  PASTE_OFFSET,
  assignNewIds,
  cloneElementWithNewIds,
  cloneSlideWithNewIds,
} from './clipboard';
export type { ClipboardContentType } from './clipboard';

export {
  deleteElementsOp,
  addElementOp,
  duplicateElementsOp,
  reorderSlideOp,
  setSlideBackgroundOp,
} from './ops';
