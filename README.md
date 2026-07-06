# PowerPoint Clone (Parity)

A TypeScript implementation of a PowerPoint-class presentation editor: a complete
document model, editing engine, rendering pipeline, and interactive UI, covering
the core PowerPoint feature surface.

## Feature areas

| Area | Module | Highlights |
| --- | --- | --- |
| Document model | `src/core`, `src/model` | Slides, sections, masters, layouts, themes, notes, comments, properties, lossless JSON serialization |
| Shapes & geometry | `src/shapes` | 25+ preset geometries, transforms (move/resize/rotate/flip), group/ungroup, align/distribute, z-order, hit-testing, connectors, snapping |
| Rich text | `src/text` | Runs/paragraphs, character & paragraph formatting, bullets and numbered lists (roman/alpha), hyperlinks, find & replace, autofit estimation |
| Styling & themes | `src/style` | Theme color resolution (tint/shade/alpha), fills (solid/gradient/picture/pattern), line styles, built-in themes, master→layout→slide inheritance, format painter |
| Tables | `src/tables` | Insert/delete rows & columns, merge/split cells, resizing, banded styles, cell geometry & hit-testing |
| Charts | `src/charts` | Column/bar/line/area/pie/doughnut/scatter, nice-axis computation, plot layout, legends |
| Transitions & animations | `src/animation` | Transition catalog, entrance/emphasis/exit/motion-path effects, click groups, timeline computation |
| Slide show | `src/slideshow` | Presenter controller (next/prev/goto), animation click sequencing, hidden slides, kiosk loop, auto-advance |
| Undo/redo & clipboard | `src/commands` | Command history with transactions and typing coalescing, element/slide clipboard with id remapping |
| Rendering | `src/render` | SVG renderer for slides, shapes, text, tables, charts; thumbnails |
| Export | `src/export` | Native JSON format, standalone HTML export, per-slide SVG |
| UI application | `src/ui` | Ribbon-style toolbar, slide panel, editor canvas with selection/drag, keyboard shortcuts, view modes |

## Development

```bash
npm install
npm test          # run the full vitest suite
npm run typecheck # tsc --noEmit
```

Units: points (pt); default slide size is 960×540 (16:9). Angles in degrees,
durations in milliseconds. The whole document model is plain serializable data —
all behavior lives in the operation modules.
