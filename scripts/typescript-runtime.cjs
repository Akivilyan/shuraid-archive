"use strict";

const fs = require("node:fs");
const path = require("node:path");

function loadTypeScript() {
  const candidates = [
    "typescript",
    process.env.COCOS_CREATOR_TYPESCRIPT,
    "C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript",
    "C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (candidate === "typescript" || fs.existsSync(path.resolve(candidate))) {
        return require(candidate);
      }
    } catch (error) {
      if (candidate === candidates[candidates.length - 1]) {
        throw error;
      }
    }
  }

  throw new Error(
    "TypeScript not found. Install dependencies or set COCOS_CREATOR_TYPESCRIPT to Cocos Creator's TypeScript module.",
  );
}

module.exports = { loadTypeScript };

