/**
 * Slide comments: add, reply, resolve, edit, delete.
 */

import type { Comment, Id, Point, Presentation, Slide } from '../core/types';
import { genId } from '../core/util';
import { getSlide } from './lookup';

export type CommentReply = Comment['replies'][number];

function getComment(slide: Slide, commentId: Id): Comment {
  const comment = slide.comments.find((c) => c.id === commentId);
  if (!comment) throw new Error(`Comment "${commentId}" not found on slide "${slide.id}"`);
  return comment;
}

/** Add a comment anchored at a slide position. */
export function addComment(
  pres: Presentation,
  slideId: Id,
  author: string,
  text: string,
  position: Point = { x: 0, y: 0 },
  now: () => number = Date.now,
): Comment {
  const slide = getSlide(pres, slideId);
  const comment: Comment = {
    id: genId('comment'),
    author,
    text,
    createdAt: now(),
    position: { ...position },
    replies: [],
    resolved: false,
  };
  slide.comments.push(comment);
  return comment;
}

/** Append a reply to an existing comment. */
export function replyToComment(
  pres: Presentation,
  slideId: Id,
  commentId: Id,
  author: string,
  text: string,
  now: () => number = Date.now,
): CommentReply {
  const slide = getSlide(pres, slideId);
  const comment = getComment(pres, slide, commentId);
  const reply: CommentReply = { id: genId('reply'), author, text, createdAt: now() };
  comment.replies.push(reply);
  return reply;
}

/** Mark a comment resolved (or unresolved). */
export function resolveComment(pres: Presentation, slideId: Id, commentId: Id, resolved = true): void {
  const slide = getSlide(pres, slideId);
  getComment(pres, slide, commentId).resolved = resolved;
}

/** Edit the text of a comment, or of a reply when the id matches a reply. */
export function editComment(pres: Presentation, slideId: Id, commentId: Id, text: string): void {
  const slide = getSlide(pres, slideId);
  const comment = slide.comments.find((c) => c.id === commentId);
  if (comment) {
    comment.text = text;
    return;
  }
  for (const c of slide.comments) {
    const reply = c.replies.find((r) => r.id === commentId);
    if (reply) {
      reply.text = text;
      return;
    }
  }
  throw new Error(`Comment "${commentId}" not found on slide "${slideId}"`);
}

/** Delete a comment (with its replies), or a single reply when the id matches a reply. */
export function deleteComment(pres: Presentation, slideId: Id, commentId: Id): void {
  const slide = getSlide(pres, slideId);
  const index = slide.comments.findIndex((c) => c.id === commentId);
  if (index !== -1) {
    slide.comments.splice(index, 1);
    return;
  }
  for (const c of slide.comments) {
    const replyIndex = c.replies.findIndex((r) => r.id === commentId);
    if (replyIndex !== -1) {
      c.replies.splice(replyIndex, 1);
      return;
    }
  }
  throw new Error(`Comment "${commentId}" not found on slide "${slideId}"`);
}
