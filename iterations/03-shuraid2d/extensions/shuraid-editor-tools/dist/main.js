'use strict';

const PACKAGE_NAME = 'shuraid-editor-tools';
let generationPromise = null;

async function runGenerator() {
  if (generationPromise) {
    return generationPromise;
  }

  generationPromise = (async () => {
    const result = await Editor.Message.request('scene', 'execute-scene-script', {
      name: PACKAGE_NAME,
      method: 'generateGuanYuStage1',
      args: [],
    });
    await Editor.Message.request('scene', 'save-scene');
    const completed = { ...result, sceneSaved: true };
    console.log(`[${PACKAGE_NAME}] GuanYu stage 1: ${JSON.stringify(completed)}`);
    return completed;
  })().catch((error) => {
    console.error(`[${PACKAGE_NAME}] GuanYu stage 1 failed`, error);
    throw error;
  }).finally(() => {
    generationPromise = null;
  });

  return generationPromise;
}

exports.methods = {
  generateGuanYuStage1() {
    return runGenerator();
  },
};

exports.load = function load() {};
exports.unload = function unload() {};
