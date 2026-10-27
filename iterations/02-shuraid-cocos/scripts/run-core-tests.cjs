"use strict";

const fs = require("node:fs");
const { loadTypeScript } = require("./typescript-runtime.cjs");

const ts = loadTypeScript();

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      strict: true,
    },
  });
  module._compile(output.outputText, filename);
};

require("../tests/core/battle-slice.test.ts");

