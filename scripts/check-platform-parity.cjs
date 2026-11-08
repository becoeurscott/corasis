// Structural checks catch catalog drift and remind contributors to update both UIs.
// This does not translate Swift into TypeScript or prove behavioral equivalence.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
process.chdir(path.resolve(__dirname, '..'));
const product = JSON.parse(fs.readFileSync('shared/product.json', 'utf8'));
const map = JSON.parse(fs.readFileSync('shared/screen-map.json', 'utf8'));
const fail = message => { console.error(message); process.exitCode = 1; };
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(directory, item.name)) : [path.join(directory, item.name)]);
const questions = new Set(product.questions.map(q => q.id));
if (questions.size !== product.questions.length) fail('Duplicate shared question IDs.');
if (new Set(product.decks.map(d => d.id)).size !== product.decks.length) fail('Duplicate shared deck IDs.');
for (const deck of product.decks) {
  if (!deck.questionIds.length || deck.questionIds.some(id => !questions.has(id))) fail(`Invalid question references in ${deck.id}.`);
  if (!product.categoryMeta[deck.category]) fail(`Unknown category in ${deck.id}.`);
}
const motion = product.motion;
if (!motion || !Number.isFinite(motion.pressScale) || motion.pressScale <= 0 || motion.pressScale > 1 || !Number.isFinite(motion.pressedOpacity) || motion.pressedOpacity <= 0 || motion.pressedOpacity > 1) fail('Invalid shared press feedback values.');
for (const key of ['pressInMs', 'releaseMs', 'transitionMs']) if (!Number.isFinite(motion?.[key]) || motion[key] < 0) fail(`Invalid motion duration: ${key}.`);
const flow = product.connectionOnboarding;
if (!flow || flow.version !== 1 || new Set(flow.questions.map(q => q.id)).size !== flow.questions.length) fail('Invalid shared connection onboarding.');
for (const question of flow.questions) {
  if (!question.options.length || new Set(question.options.map(o => o.id)).size !== question.options.length) fail(`Invalid choices for ${question.id}.`);
  for (const option of question.options) if (option.deckId && !product.decks.some(d => d.id === option.deckId && !d.premium)) fail(`Missing free recommendation deck for ${question.id}.${option.id}.`);
}
for (const [theme, palette] of Object.entries(product.palettes)) {
  for (const mode of ['light', 'dark']) for (const [key, value] of Object.entries(palette[mode])) {
    if (!/^#[\da-f]{6}$/i.test(value) && !/^rgba\(/.test(value)) fail(`Invalid color: ${theme}.${mode}.${key}`);
  }
}
for (const file of ['src/theme/tokens.ts', 'src/data/questions.ts']) if (!fs.readFileSync(file, 'utf8').includes("../../shared/product.json")) fail(`${file} must read the shared catalog.`);
if (!fs.readFileSync('native-ios/project.yml', 'utf8').includes('../shared/product.json')) fail('Xcode must bundle the shared catalog directly.');
const native = walk('native-ios/Together').filter(f => f.endsWith('.swift')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const routes = walk('src/app').filter(f => f.endsWith('.tsx') && !f.endsWith('_layout.tsx')).map(f => f.slice('src/app/'.length));
for (const route of routes) {
  if (!map[route]) fail(`Add a SwiftUI counterpart for route ${route} in shared/screen-map.json.`);
  else if (!new RegExp(`\\bstruct\\s+${map[route]}\\b`).test(native)) fail(`Missing SwiftUI view ${map[route]} for ${route}.`);
}
for (const route of Object.keys(map)) if (!routes.includes(route)) fail(`Remove obsolete route ${route} from the screen map.`);
if (process.argv.includes('--changes')) {
  const baseArg = process.argv.find(arg => arg.startsWith('--base='));
  const base = baseArg ? baseArg.slice(7) : 'HEAD';
  const tracked = cp.execFileSync('git', ['diff', '--name-only', base, '--'], { encoding: 'utf8' }).trim().split('\n');
  const untracked = cp.execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n');
  const changed = [...new Set([...tracked, ...untracked])];
  const rn = changed.some(f => /^src\/(app|components|services|lib|store)\//.test(f) && !f.includes('__tests__'));
  const swift = changed.some(f => /^native-ios\/Together\/.*\.swift$/.test(f));
  if (rn !== swift) fail('Platform-specific changes detected in only one app. Implement the matching change in SwiftUI and React Native, then validate both. Shared-only catalog edits need no duplicated UI edit.');
}
if (!process.exitCode) console.log(`Shared catalog valid: ${product.questions.length} questions, ${product.decks.length} decks, ${routes.length} routes mapped. Both apps use the same product.json.`);
