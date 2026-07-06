/**
 * Self-contained HTML export: every visible slide's SVG embedded inline,
 * one <section> per slide, with basic prev/next navigation. No external
 * resources.
 */

import type { Presentation } from '../core/types';
import { getVisibleSlides } from '../model';
import { escapeXml, renderSlideSVG } from '../render';

const STYLES = `
  html, body { margin: 0; padding: 0; background: #1e1e1e; color: #eee;
    font-family: system-ui, sans-serif; }
  header { padding: 8px 16px; display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 16px; margin: 0; flex: 1; }
  main { display: flex; justify-content: center; padding: 8px; }
  section.slide { display: none; max-width: 100%; }
  section.slide.active { display: block; }
  section.slide svg { max-width: 100%; height: auto; background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,.5); }
  button { font: inherit; padding: 4px 12px; cursor: pointer; }
`;

const SCRIPT = `
  (function () {
    var slides = Array.prototype.slice.call(document.querySelectorAll('section.slide'));
    var counter = document.getElementById('slide-counter');
    var current = 0;
    function show(i) {
      if (slides.length === 0) return;
      current = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (s, j) { s.classList.toggle('active', j === current); });
      if (counter) counter.textContent = (current + 1) + ' / ' + slides.length;
    }
    document.getElementById('prev-slide').addEventListener('click', function () { show(current - 1); });
    document.getElementById('next-slide').addEventListener('click', function () { show(current + 1); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ') show(current + 1);
      if (e.key === 'ArrowLeft') show(current - 1);
    });
    show(0);
  })();
`;

/**
 * Export the presentation as a single self-contained HTML document with all
 * visible slides and inline prev/next navigation.
 */
export function exportPresentationHTML(pres: Presentation): string {
  const title = escapeXml(pres.properties.title);
  const slides = getVisibleSlides(pres);
  const sections = slides
    .map(
      (slide, i) =>
        `<section class="slide${i === 0 ? ' active' : ''}" data-slide="${i + 1}">` +
        `${renderSlideSVG(pres, slide)}</section>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${STYLES}</style>
</head>
<body>
<header>
<h1>${title}</h1>
<button id="prev-slide" type="button">&#9664; Prev</button>
<span id="slide-counter"></span>
<button id="next-slide" type="button">Next &#9654;</button>
</header>
<main>
${sections}
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
}
