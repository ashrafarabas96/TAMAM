import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { PRICING_REASONS } from './smart-pricing';

/**
 * The spec is explicit about this: rule-based pricing must not be dressed up as
 * intelligence. What the engine does is apply the owner's rules and measure
 * their calendar — useful, explicable, and not a model. Calling it "AI
 * optimised" would be a claim the code cannot support, and an owner told "the
 * AI decided" has no way to argue with a number they should be able to change.
 *
 * So the vocabulary is checked rather than remembered. This test reads the
 * chalet module's own source and fails if a user-facing string claims otherwise.
 */

const CHALET_ROOT = join(__dirname, '..');

/** Claims the platform cannot back up, in either language. */
const FORBIDDEN = [
  /\bAI[- ]?(powered|optimi[sz]ed|driven|based|generated)\b/i,
  /\bartificial intelligence\b/i,
  /\bmachine learning\b/i,
  /\bneural\b/i,
  /\bour (AI|algorithm) (knows|predicts|learns)\b/i,
  /ذكاء اصطناعي/,
  /تعلّم الآلة|تعلم الآلة/,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return extname(path) === '.ts' ? [path] : [];
  });
}

describe('the chalet module does not claim to be AI', () => {
  const files = sourceFiles(CHALET_ROOT).filter((f) => !f.endsWith('no-fake-ai.spec.ts'));

  it('finds the module source to check', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it.each(files.map((f) => [f.slice(CHALET_ROOT.length + 1), f]))(
    '%s makes no claim the rules cannot back up',
    (_name, path) => {
      const source = readFileSync(path, 'utf8');
      for (const pattern of FORBIDDEN) {
        expect(source).not.toMatch(pattern);
      }
    },
  );
});

describe('every pricing reason is something an owner can act on', () => {
  it('is written in both languages', () => {
    for (const [code, label] of Object.entries(PRICING_REASONS)) {
      expect(label.ar.length).toBeGreaterThan(0);
      expect(label.en.length).toBeGreaterThan(0);
      // Arabic and English, not the same string twice.
      expect(label.ar).not.toBe(label.en);
      expect(code).toMatch(/^[A-Z_]+$/);
    }
  });

  it('names a fact about the calendar rather than a verdict', () => {
    // Each reason points at something the owner can see for themselves: their
    // own rule, their own week, the time of day, their own floor.
    for (const label of Object.values(PRICING_REASONS)) {
      expect(label.en).not.toMatch(/recommend|optimi[sz]|smart|intelligent|predict/i);
    }
  });
});
