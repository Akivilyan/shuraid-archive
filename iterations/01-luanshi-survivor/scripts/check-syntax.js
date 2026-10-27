"use strict";

var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var root = path.resolve(__dirname, "..");
var ignored = new Set(["node_modules"]);

function collectJavaScript(directory, result) {
  var entries = fs.readdirSync(directory, { withFileTypes: true });
  for (var index = 0; index < entries.length; index += 1) {
    var entry = entries[index];
    if (ignored.has(entry.name)) { continue; }
    var fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectJavaScript(fullPath, result);
    } else if (entry.name.endsWith(".js")) {
      result.push(fullPath);
    }
  }
}

var files = [];
collectJavaScript(root, files);
for (var index = 0; index < files.length; index += 1) {
  var source = fs.readFileSync(files[index], "utf8");
  new vm.Script(source, { filename: files[index] });
}
console.log("Syntax OK: " + files.length + " JavaScript files");
