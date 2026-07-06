import { describe, expect, it } from 'vitest';
import {
  addComment,
  createPresentation,
  deleteComment,
  editComment,
  getNotesText,
  replyToComment,
  resolveComment,
  setNotesText,
  updateProperties,
} from '../../src/model';

describe('notes', () => {
  it('round-trips plain text through the notes TextBody', () => {
    const pres = createPresentation();
    const id = pres.slides[0].id;
    expect(getNotesText(pres, id)).toBe('');
    setNotesText(pres, id, 'Remember the demo');
    expect(getNotesText(pres, id)).toBe('Remember the demo');
    expect(pres.slides[0].notes.paragraphs).toHaveLength(1);
  });

  it('maps newlines to paragraphs and back', () => {
    const pres = createPresentation();
    const id = pres.slides[0].id;
    setNotesText(pres, id, 'line one\nline two\n\nline four');
    expect(pres.slides[0].notes.paragraphs).toHaveLength(4);
    expect(getNotesText(pres, id)).toBe('line one\nline two\n\nline four');
    setNotesText(pres, id, '');
    expect(getNotesText(pres, id)).toBe('');
  });

  it('throws for unknown slides', () => {
    const pres = createPresentation();
    expect(() => setNotesText(pres, 'nope', 'x')).toThrow(/Slide "nope" not found/);
    expect(() => getNotesText(pres, 'nope')).toThrow(/Slide "nope" not found/);
  });
});

describe('comments', () => {
  const clock = (t: number) => () => t;

  it('adds comments with author, position and deterministic timestamp', () => {
    const pres = createPresentation();
    const id = pres.slides[0].id;
    const comment = addComment(pres, id, 'Ada', 'Looks great', { x: 100, y: 50 }, clock(1000));
    expect(pres.slides[0].comments).toEqual([comment]);
    expect(comment.author).toBe('Ada');
    expect(comment.text).toBe('Looks great');
    expect(comment.position).toEqual({ x: 100, y: 50 });
    expect(comment.createdAt).toBe(1000);
    expect(comment.resolved).toBe(false);
    expect(comment.replies).toEqual([]);
  });

  it('supports replies, resolve/unresolve and editing', () => {
    const pres = createPresentation();
    const id = pres.slides[0].id;
    const comment = addComment(pres, id, 'Ada', 'Fix the chart', undefined, clock(1));
    const reply = replyToComment(pres, id, comment.id, 'Bob', 'On it', clock(2));
    expect(comment.replies).toEqual([reply]);
    expect(reply.createdAt).toBe(2);

    resolveComment(pres, id, comment.id);
    expect(comment.resolved).toBe(true);
    resolveComment(pres, id, comment.id, false);
    expect(comment.resolved).toBe(false);

    editComment(pres, id, comment.id, 'Fix the chart title');
    expect(comment.text).toBe('Fix the chart title');
    editComment(pres, id, reply.id, 'Done');
    expect(comment.replies[0].text).toBe('Done');
  });

  it('deletes comments and individual replies', () => {
    const pres = createPresentation();
    const id = pres.slides[0].id;
    const c1 = addComment(pres, id, 'Ada', 'one');
    const c2 = addComment(pres, id, 'Ada', 'two');
    const r = replyToComment(pres, id, c2.id, 'Bob', 'reply');
    deleteComment(pres, id, r.id);
    expect(c2.replies).toEqual([]);
    deleteComment(pres, id, c1.id);
    expect(pres.slides[0].comments.map((c) => c.id)).toEqual([c2.id]);
    expect(() => deleteComment(pres, id, c1.id)).toThrow(/Comment .* not found/);
    expect(() => replyToComment(pres, id, 'ghost', 'X', 'y')).toThrow(/Comment "ghost" not found/);
    expect(() => resolveComment(pres, id, 'ghost')).toThrow(/Comment "ghost" not found/);
    expect(() => editComment(pres, id, 'ghost', 'z')).toThrow(/Comment "ghost" not found/);
  });
});

describe('updateProperties', () => {
  it('patches fields and bumps revision/modifiedAt via the injected clock', () => {
    const pres = createPresentation({ now: () => 100 });
    expect(pres.properties.revision).toBe(1);
    updateProperties(pres, { title: 'Q3 Review', author: 'Ada' }, () => 200);
    expect(pres.properties.title).toBe('Q3 Review');
    expect(pres.properties.author).toBe('Ada');
    expect(pres.properties.revision).toBe(2);
    expect(pres.properties.modifiedAt).toBe(200);
    expect(pres.properties.createdAt).toBe(100);
  });

  it('bumps revision even for an empty patch and accumulates', () => {
    const pres = createPresentation({ now: () => 1 });
    updateProperties(pres, {}, () => 2);
    updateProperties(pres, { subject: 'Finance' }, () => 3);
    expect(pres.properties.revision).toBe(3);
    expect(pres.properties.modifiedAt).toBe(3);
    expect(pres.properties.subject).toBe('Finance');
  });
});
