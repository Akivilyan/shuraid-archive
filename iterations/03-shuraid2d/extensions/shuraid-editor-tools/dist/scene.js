'use strict';

const { join } = require('path');
module.paths.push(join(Editor.App.path, 'node_modules'));

const FRAME_UUIDS = {
  idle: 'fe394e77-598b-43b4-8025-941458da261e@f9941',
  moveA: 'a8b38c0f-15e1-4be3-9821-67bdf7820199@f9941',
  moveB: '7c07a4a6-bd90-476c-be96-782de35f16b3@f9941',
  attackWindup: '8d7eab29-9440-40cf-a284-856e21f17793@f9941',
  attackSweep: 'a484b7d2-199c-48d5-b8b9-ffe95654faf5@f9941',
  hurt: '367cd727-0b65-434b-8227-e8110f291059@f9941',
};

const CLIP_URLS = {
  idle: 'db://assets/art/characters/guan/animations/guan-idle.anim',
  move: 'db://assets/art/characters/guan/animations/guan-move.anim',
  attack: 'db://assets/art/characters/guan/animations/guan-attack.anim',
  hurt: 'db://assets/art/characters/guan/animations/guan-hurt.anim',
};

const PREFAB_URL = 'db://assets/prefabs/characters/GuanYu.prefab';

function loadAsset(uuid) {
  const { assetManager } = require('cc');
  return new Promise((resolve, reject) => {
    assetManager.loadAny(uuid, (error, asset) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(asset);
    });
  });
}

async function queryAsset(url) {
  try {
    return await Editor.Message.request('asset-db', 'query-asset-info', url);
  } catch (_error) {
    return null;
  }
}

function serializeAsset(asset) {
  if (typeof EditorExtends !== 'undefined' && typeof EditorExtends.serialize === 'function') {
    return EditorExtends.serialize(asset);
  }
  if (asset && typeof asset.serialize === 'function') {
    return asset.serialize();
  }
  throw new Error(`No Cocos editor serializer available for ${asset && asset.name}`);
}

async function createAsset(url, asset) {
  const existing = await queryAsset(url);
  if (existing && existing.uuid) {
    return existing;
  }

  const serialized = serializeAsset(asset);
  const content = typeof serialized === 'string' ? serialized : JSON.stringify(serialized, null, 2);
  const created = await Editor.Message.request('asset-db', 'create-asset', url, content);
  if (!created) {
    throw new Error(`AssetDB did not create ${url}`);
  }
  return created;
}

async function waitForAsset(url, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    const info = await queryAsset(url);
    if (info && info.uuid) {
      return info;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function makeClip(name, spriteFrames, sample, wrapMode) {
  const { AnimationClip } = require('cc');
  const clip = AnimationClip.createWithSpriteFrames(spriteFrames, sample);
  if (!clip) {
    throw new Error(`Failed to create animation clip ${name}`);
  }
  clip.name = name;
  clip.wrapMode = wrapMode;
  clip.sample = sample;
  return clip;
}

async function ensureClipAssets(frames) {
  const { AnimationClip } = require('cc');
  const definitions = [
    ['idle', 'guan-idle', [frames.idle], 1, AnimationClip.WrapMode.Loop],
    ['move', 'guan-move', [frames.moveA, frames.moveB], 5, AnimationClip.WrapMode.Loop],
    ['attack', 'guan-attack', [frames.attackWindup, frames.attackSweep, frames.idle], 5, AnimationClip.WrapMode.Normal],
    ['hurt', 'guan-hurt', [frames.hurt, frames.idle], 8, AnimationClip.WrapMode.Normal],
  ];

  for (const [key, name, spriteFrames, sample, wrapMode] of definitions) {
    const existing = await queryAsset(CLIP_URLS[key]);
    if (!existing || !existing.uuid) {
      await createAsset(CLIP_URLS[key], makeClip(name, spriteFrames, sample, wrapMode));
    }
  }

  const loaded = {};
  for (const key of Object.keys(CLIP_URLS)) {
    const info = await waitForAsset(CLIP_URLS[key]);
    loaded[key] = await loadAsset(info.uuid);
  }
  return loaded;
}

function buildGuanYuNode(frames, clips) {
  const { Animation, Node, Sprite, UITransform, Vec3 } = require('cc');
  const root = new Node('GuanYu');
  root.setPosition(Vec3.ZERO);

  const visual = new Node('Visual');
  visual.parent = root;
  visual.setPosition(0, 65, 0);
  visual.setScale(0.35, 0.35, 1);

  const transform = visual.addComponent(UITransform);
  transform.setContentSize(512, 384);

  const sprite = visual.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.RAW;
  sprite.spriteFrame = frames.idle;

  const animation = visual.addComponent(Animation);
  animation.clips = [clips.idle, clips.move, clips.attack, clips.hurt];
  animation.defaultClip = clips.idle;
  animation.playOnLoad = true;

  return root;
}

async function ensurePrefab(frames, clips) {
  const { Prefab } = require('cc');
  let info = await queryAsset(PREFAB_URL);
  if (!info || !info.uuid) {
    const prefab = new Prefab('GuanYu');
    prefab.data = buildGuanYuNode(frames, clips);
    await createAsset(PREFAB_URL, prefab);
    info = await waitForAsset(PREFAB_URL);
  }
  return loadAsset(info.uuid);
}

exports.load = function load() {};
exports.unload = function unload() {};

exports.methods = {
  async generateGuanYuStage1() {
    const { director, instantiate } = require('cc');
    const scene = director.getScene();
    if (!scene) {
      throw new Error('No scene is currently open');
    }

    const canvas = scene.getChildByName('Canvas');
    if (!canvas) {
      throw new Error('Bootstrap scene has no Canvas node');
    }

    const frames = {};
    for (const [key, uuid] of Object.entries(FRAME_UUIDS)) {
      frames[key] = await loadAsset(uuid);
    }

    const clips = await ensureClipAssets(frames);
    const prefab = await ensurePrefab(frames, clips);

    let instance = canvas.getChildByName('GuanYu');
    if (!instance) {
      instance = instantiate(prefab);
      instance.name = 'GuanYu';
      instance.parent = canvas;
      instance.setPosition(0, 0, 0);
    }

    return {
      ok: true,
      scene: scene.name,
      prefab: PREFAB_URL,
      clips: Object.values(CLIP_URLS),
    };
  },
};
