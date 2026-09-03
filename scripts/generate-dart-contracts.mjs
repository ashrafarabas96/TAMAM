#!/usr/bin/env node
/**
 * Generates Dart enums + constants from packages/shared-types/src/enums.ts and api.ts so the
 * Flutter apps never hand-copy the vocabulary (spec §6). Output:
 *   apps/customer-mobile/lib/core/contracts/generated/tamam_contracts.dart
 *   apps/partner-mobile/lib/core/contracts/generated/tamam_contracts.dart
 * Zero dependencies: parses the `export const X = { A: 'a', ... } as const;` blocks with a regex.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const enumsSrc = readFileSync(join(root, 'packages/shared-types/src/enums.ts'), 'utf8');
const apiSrc = readFileSync(join(root, 'packages/shared-types/src/api.ts'), 'utf8');

function parseConstObjects(src) {
  const out = [];
  const re = /export const (\w+) = \{([\s\S]*?)\} as const;/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const body = m[2];
    const entries = [];
    // Not line-anchored on purpose: single-line objects (`{ AR: 'ar', EN: 'en' }`) must parse too.
    const entryRe = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'([^']*)'/g;
    let e;
    while ((e = entryRe.exec(body))) entries.push([e[1], e[2]]);
    if (entries.length) out.push({ name, entries });
  }
  return out;
}

const skip = new Set(['Headers', 'WsNamespace', 'WsEvent', 'ErrorCode']);
const enums = parseConstObjects(enumsSrc).filter((e) => !skip.has(e.name));
const apiConsts = parseConstObjects(apiSrc);

function dartName(key) {
  const lower = key.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  const reserved = new Set(['default', 'in', 'is', 'new', 'null', 'true', 'false', 'class', 'enum', 'switch', 'case', 'do', 'if', 'else', 'for', 'while', 'return', 'void', 'this', 'super', 'var', 'final', 'const']);
  return reserved.has(lower) ? `${lower}_` : lower;
}

let dart = `// AUTO-GENERATED from packages/shared-types — DO NOT EDIT. Regenerate: node scripts/generate-dart-contracts.mjs\n// ignore_for_file: constant_identifier_names, public_member_api_docs\n\n`;
for (const e of enums) {
  dart += `enum ${e.name} {\n`;
  dart += e.entries.map(([k, v]) => `  ${dartName(k)}('${v}')`).join(',\n') + ';\n\n';
  dart += `  const ${e.name}(this.value);\n  final String value;\n\n`;
  dart += `  static ${e.name}? fromValue(String? value) {\n    if (value == null) return null;\n    for (final e in ${e.name}.values) {\n      if (e.value == value) return e;\n    }\n    return null;\n  }\n}\n\n`;
}
for (const c of apiConsts) {
  dart += `abstract final class ${c.name} {\n`;
  dart += c.entries.map(([k, v]) => `  static const String ${dartName(k)} = '${v}';`).join('\n') + '\n}\n\n';
}
dart += `abstract final class ApiVersion {\n  static const String version = 'v1';\n  static const String prefix = '/api/v1';\n}\n`;

for (const app of ['customer-mobile', 'partner-mobile']) {
  const file = join(root, 'apps', app, 'lib/core/contracts/generated/tamam_contracts.dart');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, dart);
  console.log('generated', file);
}
