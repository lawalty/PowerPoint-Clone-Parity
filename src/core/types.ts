/**
 * Core document model for the PowerPoint clone.
 *
 * This file is the single source of truth for the presentation data model.
 * All modules (shapes, text, styling, animation, commands, rendering, UI)
 * operate on these types. Everything here is plain serializable data —
 * behavior lives in the operation modules.
 *
 * Units: all coordinates and sizes are in points (pt). A standard 16:9
 * slide is 960 x 540 pt. Angles are in degrees, durations in milliseconds.
 */

// ---------------------------------------------------------------------------
// Identifiers & geometry
// ---------------------------------------------------------------------------

export type Id = string;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

/** Position, size, rotation and flips for any slide element. */
export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clockwise rotation in degrees around the element center. */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

// ---------------------------------------------------------------------------
// Color & fills
// ---------------------------------------------------------------------------

/** Theme color slots, mirroring PowerPoint's scheme colors. */
export type ThemeColorSlot =
  | 'dark1'
  | 'light1'
  | 'dark2'
  | 'light2'
  | 'accent1'
  | 'accent2'
  | 'accent3'
  | 'accent4'
  | 'accent5'
  | 'accent6'
  | 'hyperlink'
  | 'followedHyperlink';

export interface RgbColor {
  type: 'rgb';
  /** Hex string without '#', e.g. 'FF0000'. */
  value: string;
  /** 0..1, default 1. */
  alpha?: number;
}

export interface ThemeColor {
  type: 'theme';
  slot: ThemeColorSlot;
  /** Lighten toward white: 0..1. */
  tint?: number;
  /** Darken toward black: 0..1. */
  shade?: number;
  alpha?: number;
}

export type Color = RgbColor | ThemeColor;

export interface GradientStop {
  /** 0..1 position along the gradient. */
  position: number;
  color: Color;
}

export interface SolidFill {
  type: 'solid';
  color: Color;
}

export interface GradientFill {
  type: 'gradient';
  kind: 'linear' | 'radial';
  /** For linear gradients: angle in degrees (0 = left-to-right). */
  angle: number;
  stops: GradientStop[];
}

export interface PictureFill {
  type: 'picture';
  /** Data URI or path reference to the image. */
  src: string;
  mode: 'stretch' | 'tile';
}

export type PatternKind =
  | 'percent50'
  | 'horizontal'
  | 'vertical'
  | 'diagonalDown'
  | 'diagonalUp'
  | 'cross'
  | 'diagonalCross';

export interface PatternFill {
  type: 'pattern';
  pattern: PatternKind;
  foreground: Color;
  background: Color;
}

export interface NoFill {
  type: 'none';
}

export type Fill = SolidFill | GradientFill | PictureFill | PatternFill | NoFill;

// ---------------------------------------------------------------------------
// Lines, shadows, effects
// ---------------------------------------------------------------------------

export type DashStyle = 'solid' | 'dash' | 'dot' | 'dashDot' | 'longDash';
export type ArrowheadKind = 'none' | 'arrow' | 'triangle' | 'diamond' | 'oval' | 'stealth';

export interface LineStyle {
  fill: Fill;
  /** Width in points. */
  width: number;
  dash: DashStyle;
  cap: 'flat' | 'round' | 'square';
  /** Arrowheads only apply to line/connector shapes. */
  headArrow?: ArrowheadKind;
  tailArrow?: ArrowheadKind;
}

export interface Shadow {
  color: Color;
  /** Blur radius in points. */
  blur: number;
  /** Offset distance in points. */
  distance: number;
  /** Direction of the offset in degrees. */
  angle: number;
}

export interface Effects {
  shadow?: Shadow;
  /** Soft reflection below the shape, 0..1 opacity. */
  reflection?: { opacity: number; offset: number };
  /** Glow around the shape. */
  glow?: { color: Color; radius: number };
  /** Soft edge feathering radius in points. */
  softEdge?: { radius: number };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface FontRef {
  /** Font family name or 'major'/'minor' to reference the theme font scheme. */
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: Color;
  /** e.g. 'baseline' | 'superscript' | 'subscript' */
  baseline: 'baseline' | 'superscript' | 'subscript';
  /** Extra letter spacing in points (can be negative). */
  letterSpacing: number;
  capitalization: 'none' | 'allCaps' | 'smallCaps';
  highlight?: Color;
}

export interface TextRun {
  type: 'run';
  text: string;
  font: FontRef;
  hyperlink?: string;
}

export interface LineBreak {
  type: 'break';
}

export type ParagraphChild = TextRun | LineBreak;

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface BulletNone {
  type: 'none';
}
export interface BulletChar {
  type: 'char';
  char: string;
  color?: Color;
}
export interface BulletNumbered {
  type: 'number';
  /** e.g. 'arabicPeriod' -> "1.", 'romanLcParen' -> "i)", 'alphaUcPeriod' -> "A." */
  format:
    | 'arabicPeriod'
    | 'arabicParen'
    | 'romanLcPeriod'
    | 'romanUcPeriod'
    | 'alphaLcPeriod'
    | 'alphaUcPeriod'
    | 'alphaLcParen';
  startAt: number;
}
export type Bullet = BulletNone | BulletChar | BulletNumbered;

export interface Paragraph {
  children: ParagraphChild[];
  align: TextAlign;
  /** Indent level, 0..8 (PowerPoint supports 9 levels). */
  level: number;
  bullet: Bullet;
  /** Line spacing multiple (1 = single, 1.5, 2 ...). */
  lineSpacing: number;
  /** Space before/after paragraph in points. */
  spaceBefore: number;
  spaceAfter: number;
  /** First-line/hanging indent in points. */
  indent: number;
}

export type TextAutofit = 'none' | 'shrink' | 'resize';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export interface TextBody {
  paragraphs: Paragraph[];
  verticalAlign: VerticalAlign;
  autofit: TextAutofit;
  wordWrap: boolean;
  /** Insets in points: left, top, right, bottom. */
  insets: { left: number; top: number; right: number; bottom: number };
  columns: number;
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** Preset geometry catalog (subset of PowerPoint's shape gallery). */
export type ShapeGeometry =
  | 'rectangle'
  | 'roundedRectangle'
  | 'ellipse'
  | 'triangle'
  | 'rightTriangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star4'
  | 'star5'
  | 'star6'
  | 'arrowRight'
  | 'arrowLeft'
  | 'arrowUp'
  | 'arrowDown'
  | 'chevron'
  | 'heart'
  | 'cloud'
  | 'speechBubble'
  | 'parallelogram'
  | 'trapezoid'
  | 'plus'
  | 'pie'
  | 'donut'
  | 'blockArc'
  | 'frame'
  | 'lightningBolt';

export type PlaceholderKind =
  | 'title'
  | 'centeredTitle'
  | 'subtitle'
  | 'body'
  | 'content'
  | 'picture'
  | 'chart'
  | 'table'
  | 'slideNumber'
  | 'date'
  | 'footer';

export interface Placeholder {
  kind: PlaceholderKind;
  /** Index links a slide placeholder to its layout counterpart. */
  index: number;
}

export interface ElementBase {
  id: Id;
  name: string;
  transform: Transform;
  hidden: boolean;
  locked: boolean;
  /** Present when this element is a placeholder instance. */
  placeholder?: Placeholder;
}

export interface ShapeElement extends ElementBase {
  type: 'shape';
  geometry: ShapeGeometry;
  /** Corner radius ratio for roundedRectangle, 0..0.5. */
  adjustment?: number;
  fill: Fill;
  line: LineStyle;
  effects: Effects;
  textBody: TextBody;
}

export interface TextBoxElement extends ElementBase {
  type: 'textbox';
  fill: Fill;
  line: LineStyle;
  effects: Effects;
  textBody: TextBody;
}

export interface PictureElement extends ElementBase {
  type: 'picture';
  src: string;
  /** Crop insets as fractions 0..1 of each edge. */
  crop: { left: number; top: number; right: number; bottom: number };
  line: LineStyle;
  effects: Effects;
  /** Alt text for accessibility. */
  altText: string;
}

export interface LineElement extends ElementBase {
  type: 'line';
  /** Connector variant. 'straight' | 'elbow' | 'curved'. */
  connector: 'straight' | 'elbow' | 'curved';
  line: LineStyle;
  /** Optional attachment to shapes by id (connection sites 0..3 = N,E,S,W). */
  startAttachment?: { elementId: Id; site: number };
  endAttachment?: { elementId: Id; site: number };
}

export interface FreeformElement extends ElementBase {
  type: 'freeform';
  /** Normalized path points (0..1 within the transform box). */
  path: { x: number; y: number; onCurve: boolean }[];
  closed: boolean;
  fill: Fill;
  line: LineStyle;
  effects: Effects;
}

export interface GroupElement extends ElementBase {
  type: 'group';
  children: SlideElement[];
}

// --- Tables ---

export interface TableCell {
  id: Id;
  textBody: TextBody;
  fill: Fill;
  /** Per-edge borders. */
  borders: {
    top?: LineStyle;
    bottom?: LineStyle;
    left?: LineStyle;
    right?: LineStyle;
  };
  /** Cells covered by a merge have rowSpan/colSpan on the anchor and merged=true elsewhere. */
  rowSpan: number;
  colSpan: number;
  merged: boolean;
}

export interface TableElement extends ElementBase {
  type: 'table';
  rows: { height: number; cells: TableCell[] }[];
  columnWidths: number[];
  /** Built-in style options. */
  firstRowHeader: boolean;
  bandedRows: boolean;
  bandedColumns: boolean;
  styleAccent: ThemeColorSlot;
}

// --- Charts ---

export type ChartKind = 'bar' | 'column' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter';

export interface ChartSeries {
  name: string;
  values: number[];
  color?: Color;
}

export interface ChartElement extends ElementBase {
  type: 'chart';
  chartKind: ChartKind;
  categories: string[];
  series: ChartSeries[];
  title: string;
  showLegend: boolean;
  legendPosition: 'right' | 'left' | 'top' | 'bottom';
  showDataLabels: boolean;
}

export type SlideElement =
  | ShapeElement
  | TextBoxElement
  | PictureElement
  | LineElement
  | FreeformElement
  | GroupElement
  | TableElement
  | ChartElement;

// ---------------------------------------------------------------------------
// Transitions & animations
// ---------------------------------------------------------------------------

export type TransitionKind =
  | 'none'
  | 'fade'
  | 'push'
  | 'wipe'
  | 'split'
  | 'reveal'
  | 'cut'
  | 'random'
  | 'shape'
  | 'uncover'
  | 'cover'
  | 'flash'
  | 'dissolve'
  | 'checkerboard'
  | 'blinds'
  | 'zoom'
  | 'morph';

export interface Transition {
  kind: TransitionKind;
  /** Duration in milliseconds. */
  duration: number;
  direction?: 'left' | 'right' | 'up' | 'down' | 'horizontal' | 'vertical' | 'in' | 'out';
  /** Advance automatically after N ms (undefined = on click only). */
  advanceAfter?: number;
  advanceOnClick: boolean;
  sound?: string;
}

export type AnimationCategory = 'entrance' | 'emphasis' | 'exit' | 'motionPath';

export type AnimationEffect =
  // entrance / exit
  | 'appear'
  | 'fade'
  | 'flyIn'
  | 'flyOut'
  | 'floatIn'
  | 'floatOut'
  | 'wipe'
  | 'split'
  | 'zoom'
  | 'grow'
  | 'bounce'
  | 'swivel'
  // emphasis
  | 'pulse'
  | 'spin'
  | 'teeter'
  | 'colorPulse'
  | 'growShrink'
  | 'transparency'
  // motion path
  | 'pathLine'
  | 'pathArc'
  | 'pathCircle'
  | 'pathCustom';

export type AnimationTrigger = 'onClick' | 'withPrevious' | 'afterPrevious';

export interface Animation {
  id: Id;
  targetElementId: Id;
  category: AnimationCategory;
  effect: AnimationEffect;
  trigger: AnimationTrigger;
  /** Delay after trigger in ms. */
  delay: number;
  duration: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  /** For motion paths: normalized waypoints relative to slide. */
  path?: Point[];
  /** Repeat count, 1 = play once. */
  repeat: number;
}

// ---------------------------------------------------------------------------
// Theme, masters, layouts
// ---------------------------------------------------------------------------

export interface ColorScheme {
  name: string;
  colors: Record<ThemeColorSlot, string>; // hex without '#'
}

export interface FontScheme {
  name: string;
  /** Headings font. */
  major: string;
  /** Body font. */
  minor: string;
}

export interface Theme {
  id: Id;
  name: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
}

export type LayoutKind =
  | 'title'
  | 'titleAndContent'
  | 'sectionHeader'
  | 'twoContent'
  | 'comparison'
  | 'titleOnly'
  | 'blank'
  | 'contentWithCaption'
  | 'pictureWithCaption';

export interface SlideLayout {
  id: Id;
  name: string;
  kind: LayoutKind;
  masterId: Id;
  background?: Fill;
  /** Placeholder elements defining default position/size/format. */
  elements: SlideElement[];
}

export interface SlideMaster {
  id: Id;
  name: string;
  themeId: Id;
  background: Fill;
  /** Shared decoration elements + default placeholders. */
  elements: SlideElement[];
  layoutIds: Id[];
}

// ---------------------------------------------------------------------------
// Slides & presentation
// ---------------------------------------------------------------------------

export interface Comment {
  id: Id;
  author: string;
  text: string;
  /** Creation time, ms since epoch. */
  createdAt: number;
  /** Anchor position on the slide. */
  position: Point;
  replies: { id: Id; author: string; text: string; createdAt: number }[];
  resolved: boolean;
}

export interface Slide {
  id: Id;
  layoutId: Id;
  /** When set, overrides the layout/master background. */
  background?: Fill;
  elements: SlideElement[];
  transition: Transition;
  animations: Animation[];
  notes: TextBody;
  comments: Comment[];
  hidden: boolean;
  /** Hide layout/master decoration graphics. */
  hideBackgroundGraphics: boolean;
}

export interface Section {
  id: Id;
  name: string;
  /** Ids of slides belonging to this section, in presentation order. */
  slideIds: Id[];
}

export interface DocumentProperties {
  title: string;
  author: string;
  subject: string;
  createdAt: number;
  modifiedAt: number;
  revision: number;
}

export interface Presentation {
  id: Id;
  /** Format version for forwards-compatible serialization. */
  formatVersion: 1;
  properties: DocumentProperties;
  slideSize: Size;
  slides: Slide[];
  sections: Section[];
  masters: SlideMaster[];
  layouts: SlideLayout[];
  themes: Theme[];
  /** Id of the default master. */
  defaultMasterId: Id;
}

// ---------------------------------------------------------------------------
// Selection & editor state (UI-facing, still serializable)
// ---------------------------------------------------------------------------

export interface TextSelection {
  elementId: Id;
  paragraphIndex: number;
  /** Character offsets within the paragraph's concatenated text. */
  start: number;
  end: number;
}

export interface EditorSelection {
  slideId: Id | null;
  elementIds: Id[];
  text?: TextSelection;
}

export type ViewMode = 'normal' | 'sorter' | 'notes' | 'reading' | 'outline';
