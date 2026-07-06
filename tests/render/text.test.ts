import { describe, expect, it } from 'vitest';
import { defaultParagraph, paragraphOf, rgb, textBodyOf, textRun } from '../../src/core/defaults';
import { createShape, createTextBox } from '../../src/shapes';
import { renderSlideSVG } from '../../src/render';
import { newPres, slideWith, wellFormedError } from './helpers';

describe('text rendering', () => {
  it('renders runs as tspans with resolved font family and color', () => {
    const pres = newPres();
    const slide = slideWith(pres, createTextBox('Hello world', { x: 10, y: 10 }));
    const svg = renderSlideSVG(pres, slide);
    // 'minor' resolves to the Office body font.
    expect(svg).toMatch(/<tspan[^>]*font-family="Calibri"[^>]*>Hello world<\/tspan>/);
    expect(svg).toMatch(/fill="rgb\(0, 0, 0\)"/);
    expect(wellFormedError(svg)).toBeNull();
  });

  it('renders bold/italic/underline attributes', () => {
    const pres = newPres();
    const box = createTextBox('', { x: 10, y: 10 });
    box.textBody = textBodyOf('styled');
    box.textBody.paragraphs[0].children = [
      textRun('styled', { bold: true, italic: true, underline: true }),
    ];
    const slide = slideWith(pres, box);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('text-decoration="underline"');
  });

  it('applies allCaps capitalization', () => {
    const pres = newPres();
    const box = createTextBox('', { x: 10, y: 10 });
    box.textBody = textBodyOf('shout');
    box.textBody.paragraphs[0].children = [textRun('shout', { capitalization: 'allCaps' })];
    const slide = slideWith(pres, box);
    expect(renderSlideSVG(pres, slide)).toContain('>SHOUT<');
  });

  it('renders char bullets as a prefix', () => {
    const pres = newPres();
    const box = createTextBox('', { x: 10, y: 10, width: 400 });
    box.textBody = textBodyOf('First point');
    box.textBody.paragraphs[0].bullet = { type: 'char', char: '•' };
    const slide = slideWith(pres, box);
    expect(renderSlideSVG(pres, slide)).toContain('>• </tspan>');
  });

  it('renders numbered bullets with sequential labels', () => {
    const pres = newPres();
    const box = createTextBox('', { x: 10, y: 10, width: 400, height: 200 });
    box.textBody = textBodyOf('Alpha');
    box.textBody.paragraphs = [
      paragraphOf('Alpha', { bullet: { type: 'number', format: 'arabicPeriod', startAt: 1 } }),
      paragraphOf('Beta', { bullet: { type: 'number', format: 'arabicPeriod', startAt: 1 } }),
    ];
    const slide = slideWith(pres, box);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toContain('>1. </tspan>');
    expect(svg).toContain('>2. </tspan>');
  });

  it('centered paragraphs use text-anchor="middle"', () => {
    const pres = newPres();
    const box = createTextBox('', { x: 0, y: 0, width: 200, height: 50 });
    box.textBody = textBodyOf('centered');
    box.textBody.paragraphs[0].align = 'center';
    const slide = slideWith(pres, box);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toMatch(/<text x="100" [^>]*text-anchor="middle"/);
  });

  it('right-aligned paragraphs use text-anchor="end"', () => {
    const pres = newPres();
    const box = createTextBox('', { x: 0, y: 0, width: 200, height: 50 });
    box.textBody = textBodyOf('right');
    box.textBody.paragraphs[0].align = 'right';
    const slide = slideWith(pres, box);
    expect(renderSlideSVG(pres, slide)).toContain('text-anchor="end"');
  });

  it('bottom vertical alignment pushes text lower than top alignment', () => {
    const pres = newPres();
    const mk = (valign: 'top' | 'bottom') => {
      const shape = createShape('rectangle', { x: 0, y: 0, width: 300, height: 200 });
      shape.fill = { type: 'none' };
      shape.textBody = textBodyOf('anchored', { verticalAlign: valign });
      return shape;
    };
    const topSlide = slideWith(pres, mk('top'));
    const bottomSlide = slideWith(pres, mk('bottom'));
    const yOf = (svg: string) => Number(/<text x="[^"]+" y="([^"]+)"/.exec(svg)![1]);
    expect(yOf(renderSlideSVG(pres, bottomSlide))).toBeGreaterThan(
      yOf(renderSlideSVG(pres, topSlide)),
    );
  });

  it('wraps long text into multiple <text> lines', () => {
    const pres = newPres();
    const shape = createShape('rectangle', { x: 0, y: 0, width: 80, height: 200 });
    shape.textBody = textBodyOf('aaaa bbbb cccc');
    const slide = slideWith(pres, shape);
    const svg = renderSlideSVG(pres, slide);
    const lines = svg.match(/<text /g) ?? [];
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('explicit line breaks split lines', () => {
    const pres = newPres();
    const box = createTextBox('', { x: 0, y: 0, width: 400, height: 100 });
    const p = defaultParagraph({
      children: [textRun('one'), { type: 'break' }, textRun('two')],
    });
    box.textBody = textBodyOf('');
    box.textBody.paragraphs = [p];
    const slide = slideWith(pres, box);
    const svg = renderSlideSVG(pres, slide);
    expect((svg.match(/<text /g) ?? []).length).toBe(2);
  });

  it('colored char bullets use the bullet color', () => {
    const pres = newPres();
    const box = createTextBox('', { x: 10, y: 10, width: 400 });
    box.textBody = textBodyOf('point');
    box.textBody.paragraphs[0].bullet = { type: 'char', char: '-', color: rgb('FF0000') };
    const slide = slideWith(pres, box);
    const svg = renderSlideSVG(pres, slide);
    expect(svg).toMatch(/<tspan[^>]*fill="rgb\(255, 0, 0\)"[^>]*>- <\/tspan>/);
  });
});
