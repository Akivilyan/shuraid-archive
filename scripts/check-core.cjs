"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadTypeScript } = require("./typescript-runtime.cjs");

const ts = loadTypeScript();
const root = path.resolve(__dirname, "..");

function collectTypeScriptFiles(directory, output) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectTypeScriptFiles(fullPath, output);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      output.push(fullPath);
    }
  }
}

const files = [];
collectTypeScriptFiles(path.join(root, "assets", "scripts", "core"), files);
files.push(path.join(root, "assets", "scripts", "game", "FixedStepRunner.ts"));

const program = ts.createProgram(files, {
  noEmit: true,
  strict: true,
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  skipLibCheck: true,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  };
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
  process.exitCode = 1;
} else {
  process.stdout.write(`Core type check passed (${files.length} TypeScript files).\n`);
}
