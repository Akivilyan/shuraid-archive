import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  '.creator/default-meta.json',
  'settings/v2/packages/engine.json',
  'assets/scenes/BattleSlice.scene',
  'assets/scenes/BattleSlice.scene.meta',
  'assets/scripts/core/BattleModel.ts',
  'assets/scripts/game/BattleRoot.ts',
  'assets/scripts/game/BattleRoot.ts.meta',
  'scripts/cocos-build-config/wechatgame.json',
];

for (const relative of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, relative)), 'Missing required project file: ' + relative);
}
assert.ok(fs.existsSync(path.join(root, '.git')), 'Local Git repository is missing');

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.creator.version, '3.8.8');
assert.ok(packageJson.scripts.test);
assert.ok(packageJson.scripts['build:wechat']);

const scene = JSON.parse(fs.readFileSync(path.join(root, 'assets/scenes/BattleSlice.scene'), 'utf8'));
const sceneMeta = JSON.parse(fs.readFileSync(path.join(root, 'assets/scenes/BattleSlice.scene.meta'), 'utf8'));
const scriptMeta = JSON.parse(fs.readFileSync(path.join(root, 'assets/scripts/game/BattleRoot.ts.meta'), 'utf8'));
const buildConfig = JSON.parse(fs.readFileSync(path.join(root, 'scripts/cocos-build-config/wechatgame.json'), 'utf8'));

function compressUuid(uuid) {
  const hex = uuid.replace(/-/g, '');
  const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let compressed = hex.slice(0, 5);
  for (let index = 5; index < 32; index += 3) {
    const first = Number.parseInt(hex[index], 16);
    const second = Number.parseInt(hex[index + 1], 16);
    const third = Number.parseInt(hex[index + 2], 16);
    compressed += keys[(first << 2) | (second >> 2)];
    compressed += keys[((second & 3) << 4) | third];
  }
  return compressed;
}

assert.equal(buildConfig.startScene, sceneMeta.uuid);
assert.equal(buildConfig.scenes[0].uuid, sceneMeta.uuid);
assert.equal(buildConfig.platform, 'wechatgame');
assert.equal(buildConfig.designResolution.width, 390);
assert.equal(buildConfig.designResolution.height, 844);
assert.equal(buildConfig.packages.wechatgame.orientation, 'portrait');
assert.ok(scene.some((entry) => entry.__type__ === compressUuid(scriptMeta.uuid)), 'BattleRoot is not attached to the scene');

const battleRootSource = fs.readFileSync(path.join(root, 'assets/scripts/game/BattleRoot.ts'), 'utf8');
assert.ok(!battleRootSource.includes('?.'), 'Optional chaining is not allowed in the Mini Game runtime');
assert.ok(!battleRootSource.includes('??'), 'Nullish coalescing is not allowed in the Mini Game runtime');
assert.match(battleRootSource, /const CARD_WIDTH = 326/);
assert.match(battleRootSource, /const CARD_HEIGHT = 112/);
assert.match(battleRootSource, /const RESTART_HEIGHT = 72/);
assert.match(battleRootSource, /LabelOutline/);
assert.match(battleRootSource, /FIXED_STEP/);

console.log('Project verification passed: official template markers, scene wiring, touch sizing, HUD readability, and WeChat build config.');
