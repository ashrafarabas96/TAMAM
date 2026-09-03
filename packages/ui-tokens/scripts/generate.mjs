#!/usr/bin/env node
/**
 * TAMAM design-token generator.
 * Reads tokens.json and emits:
 *   - dist/tokens.ts                                 (admin-web / any TS consumer)
 *   - dist/tokens.css                                (CSS custom properties, light + dark)
 *   - ../../apps/customer-mobile/lib/core/theme/generated/tamam_tokens.dart
 *   - ../../apps/partner-mobile/lib/core/theme/generated/tamam_tokens.dart
 *
 * Zero dependencies on purpose: it must run before `pnpm install` finishes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const tokens = JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));

const HEADER = `// AUTO-GENERATED from packages/ui-tokens/tokens.json — DO NOT EDIT BY HAND.\n// Regenerate with: pnpm tokens:generate\n`;

function ensureDir(file) {
  mkdirSync(dirname(file), { recursive: true });
}

/* ---------------------------------- TS ---------------------------------- */
function emitTs() {
  const out = `${HEADER}
export const tokens = ${JSON.stringify(tokens, null, 2)} as const;

export type Tokens = typeof tokens;
export type ThemeMode = 'light' | 'dark';
export type BannerPlacement = keyof typeof tokens.banner.placements;
export type BannerTheme = keyof typeof tokens.banner.themes;

export const lightTheme = tokens.color.light;
export const darkTheme = tokens.color.dark;
export const brand = tokens.color.brand;
export const neutral = tokens.color.neutral;
export const semantic = tokens.color.semantic;
export const radius = tokens.radius;
export const spacing = tokens.spacing;
export const typography = tokens.typography;
export const motion = tokens.motion;
export const bannerPlacements = tokens.banner.placements;
export const bannerThemes = tokens.banner.themes;
`;
  const file = join(root, 'dist', 'tokens.ts');
  ensureDir(file);
  writeFileSync(file, out);
  return file;
}

/* ---------------------------------- CSS --------------------------------- */
function cssVars(obj, prefix) {
  return Object.entries(obj)
    .map(([k, v]) => `  --${prefix}-${k}: ${v};`)
    .join('\n');
}
function emitCss() {
  const c = tokens.color;
  const out = `/* ${HEADER.replace(/\/\/ /g, '').trim()} */
:root {
${cssVars(c.light, 'c')}
${Object.entries(c.brand.purple).map(([k, v]) => `  --purple-${k}: ${v};`).join('\n')}
${Object.entries(c.brand.yellow).map(([k, v]) => `  --yellow-${k}: ${v};`).join('\n')}
${Object.entries(c.neutral).map(([k, v]) => `  --neutral-${k}: ${v};`).join('\n')}
${Object.entries(tokens.radius).map(([k, v]) => `  --radius-${k}: ${typeof v === 'number' ? v + 'px' : v};`).join('\n')}
${Object.entries(tokens.spacing).map(([k, v]) => `  --space-${k}: ${v}px;`).join('\n')}
  --font-arabic: "${tokens.typography.fontFamily.arabic}", ${tokens.typography.fontFamily.fallbackArabic};
  --font-latin: "${tokens.typography.fontFamily.latin}", ${tokens.typography.fontFamily.fallbackLatin};
  --motion-fast: ${tokens.motion.durationFast}ms;
  --motion-base: ${tokens.motion.durationBase}ms;
  --motion-slow: ${tokens.motion.durationSlow}ms;
  --easing-standard: ${tokens.motion.easingStandard};
  --easing-emphasized: ${tokens.motion.easingEmphasized};
}
:root[data-theme="dark"] {
${cssVars(c.dark, 'c')}
}
`;
  const file = join(root, 'dist', 'tokens.css');
  ensureDir(file);
  writeFileSync(file, out);
  return file;
}

/* --------------------------------- DART --------------------------------- */
function hexToDart(hex) {
  // Accepts #RRGGBB or #RRGGBBAA → Color(0xAARRGGBB)
  const h = hex.replace('#', '');
  if (h.length === 6) return `Color(0xFF${h.toUpperCase()})`;
  if (h.length === 8) return `Color(0x${h.slice(6, 8).toUpperCase()}${h.slice(0, 6).toUpperCase()})`;
  throw new Error(`Unsupported colour ${hex}`);
}
function camel(s) {
  return s.replace(/[-_ ](\w)/g, (_, ch) => ch.toUpperCase());
}
/** Emits a valid Dart double literal for any JSON number (2 → `2.0`, 2.25 → `2.25`). */
function dartDouble(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Unsupported numeric token ${String(v)}`);
  return Number.isInteger(v) ? `${v}.0` : `${v}`;
}
function emitDart(targetDir) {
  const c = tokens.color;
  const lines = [];
  lines.push(HEADER.replace(/\/\/ /g, '// '));
  lines.push(`// ignore_for_file: constant_identifier_names, public_member_api_docs`);
  lines.push(`import 'package:flutter/material.dart';\n`);

  lines.push(`/// Brand palette (purple + yellow) — Getir-inspired identity.`);
  lines.push(`abstract final class TamamBrand {`);
  for (const [k, v] of Object.entries(c.brand.purple)) lines.push(`  static const Color purple${k} = ${hexToDart(v)};`);
  for (const [k, v] of Object.entries(c.brand.yellow)) lines.push(`  static const Color yellow${k} = ${hexToDart(v)};`);
  lines.push(`}\n`);

  lines.push(`abstract final class TamamNeutral {`);
  for (const [k, v] of Object.entries(c.neutral)) lines.push(`  static const Color n${k} = ${hexToDart(v)};`);
  lines.push(`}\n`);

  lines.push(`abstract final class TamamSemantic {`);
  for (const [k, v] of Object.entries(c.semantic)) {
    for (const [kk, vv] of Object.entries(v)) lines.push(`  static const Color ${k}${kk[0].toUpperCase()}${kk.slice(1)} = ${hexToDart(vv)};`);
  }
  lines.push(`}\n`);

  lines.push(`abstract final class TamamServiceColors {`);
  for (const [k, v] of Object.entries(c.service)) lines.push(`  static const Color ${k} = ${hexToDart(v)};`);
  lines.push(`}\n`);

  lines.push(`/// Semantic colour scheme resolved per theme mode.`);
  lines.push(`class TamamColorScheme {`);
  lines.push(`  const TamamColorScheme({`);
  for (const k of Object.keys(c.light)) lines.push(`    required this.${k},`);
  lines.push(`  });\n`);
  for (const k of Object.keys(c.light)) lines.push(`  final Color ${k};`);
  lines.push(``);
  lines.push(`  static const TamamColorScheme light = TamamColorScheme(`);
  for (const [k, v] of Object.entries(c.light)) lines.push(`    ${k}: ${hexToDart(v)},`);
  lines.push(`  );\n`);
  lines.push(`  static const TamamColorScheme dark = TamamColorScheme(`);
  for (const [k, v] of Object.entries(c.dark)) lines.push(`    ${k}: ${hexToDart(v)},`);
  lines.push(`  );`);
  lines.push(`}\n`);

  lines.push(`abstract final class TamamSpacing {`);
  for (const [k, v] of Object.entries(tokens.spacing)) lines.push(`  static const double s${k} = ${dartDouble(v)};`);
  lines.push(`}\n`);

  lines.push(`abstract final class TamamRadius {`);
  for (const [k, v] of Object.entries(tokens.radius)) lines.push(`  static const double ${k} = ${dartDouble(v)};`);
  lines.push(`}\n`);

  lines.push(`abstract final class TamamSize {`);
  for (const [k, v] of Object.entries(tokens.size)) lines.push(`  static const double ${k} = ${dartDouble(v)};`);
  lines.push(`}\n`);

  lines.push(`/// Elevation tokens as ready-to-use shadow lists (soft, brand-tinted).`);
  lines.push(`abstract final class TamamElevation {`);
  for (const [k, v] of Object.entries(tokens.elevation)) {
    lines.push(
      `  static const List<BoxShadow> ${k} = <BoxShadow>[BoxShadow(color: ${hexToDart(v.color)}, offset: Offset(0.0, ${dartDouble(v.y)}), blurRadius: ${dartDouble(v.blur)}, spreadRadius: ${dartDouble(v.spread)})];`,
    );
  }
  lines.push(`}\n`);

  lines.push(`abstract final class TamamMotion {`);
  for (const [k, v] of Object.entries(tokens.motion)) {
    if (typeof v === 'number') lines.push(`  static const Duration ${k} = Duration(milliseconds: ${v});`);
  }
  lines.push(`}\n`);

  lines.push(`abstract final class TamamFonts {`);
  lines.push(`  static const String arabic = '${tokens.typography.fontFamily.arabic}';`);
  lines.push(`  static const String latin = '${tokens.typography.fontFamily.latin}';`);
  lines.push(`  static const String mono = '${tokens.typography.fontFamily.mono}';`);
  lines.push(`}\n`);

  lines.push(`class TamamTypeStyle {`);
  lines.push(`  const TamamTypeStyle(this.size, this.lineHeight, this.weight, this.letterSpacing);`);
  lines.push(`  final double size;`);
  lines.push(`  final double lineHeight;`);
  lines.push(`  final FontWeight weight;`);
  lines.push(`  final double letterSpacing;`);
  lines.push(`  TextStyle toTextStyle({Color? color, String? fontFamily}) => TextStyle(`);
  lines.push(`        fontSize: size,`);
  lines.push(`        height: lineHeight / size,`);
  lines.push(`        fontWeight: weight,`);
  lines.push(`        letterSpacing: letterSpacing,`);
  lines.push(`        color: color,`);
  lines.push(`        fontFamily: fontFamily,`);
  lines.push(`      );`);
  lines.push(`}\n`);

  const fw = (w) => `FontWeight.w${w}`;
  lines.push(`abstract final class TamamType {`);
  for (const [k, v] of Object.entries(tokens.typography.scale)) {
    lines.push(
      `  static const TamamTypeStyle ${k} = TamamTypeStyle(${dartDouble(v.size)}, ${dartDouble(v.lineHeight)}, ${fw(v.weight)}, ${dartDouble(v.letterSpacing)});`,
    );
  }
  lines.push(`}\n`);

  lines.push(`enum BannerPlacement { ${Object.keys(tokens.banner.placements).map((k) => camel(k.toLowerCase())).join(', ')} }\n`);
  lines.push(`class BannerPlacementSpec {`);
  lines.push(`  const BannerPlacementSpec({required this.aspectRatio, required this.maxItems, required this.autoplay, required this.style});`);
  lines.push(`  final double aspectRatio;`);
  lines.push(`  final int maxItems;`);
  lines.push(`  final Duration autoplay;`);
  lines.push(`  final String style;`);
  lines.push(`}\n`);
  lines.push(`abstract final class TamamBannerSpecs {`);
  lines.push(`  static const Map<BannerPlacement, BannerPlacementSpec> byPlacement = {`);
  for (const [k, v] of Object.entries(tokens.banner.placements)) {
    lines.push(`    BannerPlacement.${camel(k.toLowerCase())}: BannerPlacementSpec(aspectRatio: ${dartDouble(v.aspectRatio)}, maxItems: ${v.maxItems}, autoplay: Duration(milliseconds: ${v.autoplayMs}), style: '${v.style}'),`);
  }
  lines.push(`  };`);
  lines.push(`  static BannerPlacement? fromApi(String value) {`);
  lines.push(`    switch (value) {`);
  for (const k of Object.keys(tokens.banner.placements)) lines.push(`      case '${k}': return BannerPlacement.${camel(k.toLowerCase())};`);
  lines.push(`      default: return null;`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`}\n`);

  lines.push(`class BannerThemeSpec {`);
  lines.push(`  const BannerThemeSpec({required this.background, required this.foreground, required this.accent, this.gradient});`);
  lines.push(`  final Color background;`);
  lines.push(`  final Color foreground;`);
  lines.push(`  final Color accent;`);
  lines.push(`  final List<Color>? gradient;`);
  lines.push(`}\n`);
  lines.push(`abstract final class TamamBannerThemes {`);
  lines.push(`  static const Map<String, BannerThemeSpec> byName = {`);
  for (const [k, v] of Object.entries(tokens.banner.themes)) {
    const grad = v.background.startsWith('linear-gradient');
    if (grad) {
      const stops = [...v.background.matchAll(/#([0-9A-Fa-f]{6})/g)].map((m) => `#${m[1]}`);
      lines.push(`    '${k}': BannerThemeSpec(background: ${hexToDart(stops[0])}, foreground: ${hexToDart(v.foreground)}, accent: ${hexToDart(v.accent)}, gradient: [${stops.map(hexToDart).join(', ')}]),`);
    } else {
      lines.push(`    '${k}': BannerThemeSpec(background: ${hexToDart(v.background)}, foreground: ${hexToDart(v.foreground)}, accent: ${hexToDart(v.accent)}),`);
    }
  }
  lines.push(`  };`);
  lines.push(`}`);

  const file = join(targetDir, 'lib', 'core', 'theme', 'generated', 'tamam_tokens.dart');
  ensureDir(file);
  writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

const written = [
  emitTs(),
  emitCss(),
  emitDart(resolve(root, '../../apps/customer-mobile')),
  emitDart(resolve(root, '../../apps/partner-mobile')),
];
for (const f of written) console.log('generated', f);
