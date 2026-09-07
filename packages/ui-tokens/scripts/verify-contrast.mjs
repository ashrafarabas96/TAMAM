#!/usr/bin/env node
/**
 * Gate: every foreground/background pair the UI actually renders must clear
 * WCAG 2.1 AA in BOTH themes. Exits non-zero if any pair fails, so a palette
 * edit cannot ship an unreadable combination.
 *
 * This exists because the previous palette shipped eleven failing pairs, the
 * worst being white text on the dark-mode primary button at 2.69:1 — every
 * primary button in dark mode was illegible.
 *
 * Zero dependencies, same as the generator.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminance(hex) {
  const h = hex.replace('#', '').slice(0, 6);
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum]. 4.5 = body text, 3.0 = large text / UI parts. */
const PAIRS = [
  ['textPrimary', 'background', 4.5],
  ['textPrimary', 'surface', 4.5],
  ['textPrimary', 'surfaceAlt', 4.5],
  ['textSecondary', 'background', 4.5],
  ['textSecondary', 'surface', 4.5],
  ['textSecondary', 'surfaceAlt', 4.5],
  ['textTertiary', 'surface', 4.5],
  ['textTertiary', 'background', 4.5],
  ['textOnBrand', 'surfaceBrand', 4.5],
  ['textOnBrand', 'primary', 4.5],
  ['textOnBrand', 'primaryHover', 4.5],
  ['textOnBrand', 'primaryPressed', 4.5],
  ['textOnAccent', 'accent', 4.5],
  ['textOnAccent', 'accentHover', 4.5],
  ['textOnAccent', 'accentPressed', 4.5],
  // `primary` is the FILL a white label sits on (gated above). The brand purple
  // is too dark to also be a foreground on a dark page, so the foreground role
  // has its own token and that is what gets gated here. Checking the fill as a
  // foreground would force the brand hue to move, and the brand hue does not move.
  ['primaryInk', 'background', 3.0],
  ['primaryInk', 'surface', 3.0],
  ['borderStrong', 'surface', 3.0],
  ['success', 'surface', 4.5],
  ['success', 'background', 4.5],
  ['warning', 'surface', 4.5],
  ['warning', 'background', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'background', 4.5],
  ['info', 'surface', 4.5],
  ['info', 'background', 4.5],
  // The expressive layer: brand colour used as ink and as rules. It exists so
  // coloured type stays readable instead of becoming decoration, so it is gated
  // like any other text colour.
  ['accentInk', 'surface', 4.5],
  ['accentInk', 'background', 4.5],
  ['primaryInk', 'surface', 4.5],
  ['primaryInk', 'background', 4.5],
  ['accentRule', 'surface', 3.0],
  ['primaryRule', 'surface', 3.0],
  ['textOnBrandMuted', 'surfaceBrand', 4.5],
  // A filled destructive button, which is a different job from danger-as-text.
  ['textOnDanger', 'dangerSurface', 4.5],
  ['successStrong', 'successSoft', 4.5],
  ['warningStrong', 'warningSoft', 4.5],
  ['dangerStrong', 'dangerSoft', 4.5],
  ['infoStrong', 'infoSoft', 4.5],
];

const failures = [];
let checked = 0;

for (const mode of ['light', 'dark']) {
  const p = tokens.color[mode];
  for (const [fg, bg, need] of PAIRS) {
    if (!(fg in p) || !(bg in p)) {
      failures.push(`${mode}: token missing for pair ${fg}/${bg}`);
      continue;
    }
    const r = contrast(p[fg], p[bg]);
    checked += 1;
    if (r < need) {
      failures.push(
        `${mode}: ${fg} ${p[fg]} on ${bg} ${p[bg]} = ${r.toFixed(2)}:1, needs ${need}:1`,
      );
    }
  }
}

// Banner themes render text directly on their own background.
for (const [name, theme] of Object.entries(tokens.banner.themes)) {
  const bg = theme.background.startsWith('linear-gradient')
    ? (theme.background.match(/#[0-9A-Fa-f]{6}/g) || []).slice(-1)[0]
    : theme.background;
  if (!bg) continue;
  const r = contrast(theme.foreground, bg);
  checked += 1;
  if (r < 4.5) {
    failures.push(`banner "${name}": foreground ${theme.foreground} on ${bg} = ${r.toFixed(2)}:1, needs 4.5:1`);
  }
}

// The yellow rule is a property of the brand, not a preference: assert it holds
// so nobody "fixes" the palette by making yellow a text colour on light ground.
const yellowOnWhite = contrast(tokens.color.brand.yellow['500'], '#FFFFFF');
if (yellowOnWhite >= 3) {
  failures.push(
    `brand yellow now reads ${yellowOnWhite.toFixed(2)}:1 on white — the documented yellowRule assumes it cannot carry foreground content on light surfaces; update meta.yellowRule deliberately if this was intended`,
  );
}

if (failures.length) {
  console.error(`\ncontrast gate FAILED — ${failures.length} of ${checked} pairs:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`contrast gate passed — ${checked} pairs clear WCAG AA in both themes`);
