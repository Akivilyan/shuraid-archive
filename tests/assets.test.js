"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

test("the accepted cartoon home screen is compact and the rejected realistic draft is absent", function () {
  var assetDirectory = path.join(__dirname, "..", "assets", "ui");
  var cartoon = path.join(assetDirectory, "home-cartoon-v1.jpg");
  var rejected = path.join(assetDirectory, "home-camp-v1.jpg");
  var data = fs.readFileSync(cartoon);

  assert.equal(data[0], 0xff);
  assert.equal(data[1], 0xd8);
  assert.ok(data.length < 200 * 1024);
  assert.equal(fs.existsSync(rejected), false);
});

test("the pushed stove enemy atlas contains five normalized animation frames", function () {
  var atlas = path.join(__dirname, "..", "assets", "sprites", "enemies", "pushed-stove", "pushed-stove-atlas.png");
  var data = fs.readFileSync(atlas);
  assert.equal(data.toString("ascii", 1, 4), "PNG");
  assert.equal(data.readUInt32BE(16), 512 * 5);
  assert.equal(data.readUInt32BE(20), 320);
  assert.ok(data.length < 2 * 1024 * 1024);
});

test("the Guan Yu hero atlas contains six normalized animation frames", function () {
  var atlas = path.join(__dirname, "..", "assets", "sprites", "heroes", "guan", "guan-atlas.png");
  var data = fs.readFileSync(atlas);
  assert.equal(data.toString("ascii", 1, 4), "PNG");
  assert.equal(data.readUInt32BE(16), 512 * 6);
  assert.equal(data.readUInt32BE(20), 384);
  assert.ok(data.length < 2 * 1024 * 1024);
});

test("the Zhuge Liang hero atlas contains six normalized animation frames", function () {
  var atlas = path.join(__dirname, "..", "assets", "sprites", "heroes", "zhuge", "zhuge-atlas.png");
  var data = fs.readFileSync(atlas);
  assert.equal(data.toString("ascii", 1, 4), "PNG");
  assert.equal(data.readUInt32BE(16), 512 * 6);
  assert.equal(data.readUInt32BE(20), 384);
  assert.ok(data.length < 2 * 1024 * 1024);
});

test("the common kitchen enemy atlases contain six normalized frames each", function () {
  ["head-cook", "pot-lid-guard", "bun-thrower"].forEach(function (name) {
    var atlas = path.join(__dirname, "..", "assets", "sprites", "enemies", name, name + "-atlas.png");
    var data = fs.readFileSync(atlas);
    assert.equal(data.toString("ascii", 1, 4), "PNG");
    assert.equal(data.readUInt32BE(16), 384 * 6);
    assert.equal(data.readUInt32BE(20), 384);
    assert.ok(data.length < 2 * 1024 * 1024);
  });
});

test("the upload package uses compact runtime atlases and ignores source art", function () {
  var root = path.join(__dirname, "..");
  var expected = {
    "pushed-stove-atlas.png": [384 * 5, 240],
    "guan-atlas.png": [384 * 6, 288],
    "zhuge-atlas.png": [384 * 6, 288],
    "head-cook-atlas.png": [288 * 6, 288],
    "pot-lid-guard-atlas.png": [288 * 6, 288],
    "bun-thrower-atlas.png": [288 * 6, 288]
  };
  var runtimeBytes = 0;
  Object.keys(expected).forEach(function (name) {
    var data = fs.readFileSync(path.join(root, "assets", "runtime", name));
    runtimeBytes += data.length;
    assert.equal(data.readUInt32BE(16), expected[name][0]);
    assert.equal(data.readUInt32BE(20), expected[name][1]);
  });
  assert.ok(runtimeBytes < 2.5 * 1024 * 1024);

  var projectConfig = JSON.parse(fs.readFileSync(path.join(root, "project.config.json"), "utf8"));
  var ignoredFolders = projectConfig.packOptions.ignore.filter(function (entry) {
    return entry.type === "folder";
  }).map(function (entry) { return entry.value; });
  assert.ok(ignoredFolders.includes("assets/concepts"));
  assert.ok(ignoredFolders.includes("assets/sprites"));
  assert.ok(ignoredFolders.includes("tests"));
  assert.ok(ignoredFolders.includes("scripts"));
  assert.ok(ignoredFolders.includes(".git"));
});

test("the original soundtrack and effects are valid compact WAV assets", function () {
  var root = path.join(__dirname, "..", "assets", "audio");
  var files = [
    "bgm/calm.wav", "bgm/heroic.wav", "bgm/danger.wav",
    "sfx/attack.wav", "sfx/shot.wav", "sfx/enemy-hit.wav",
    "sfx/player-hit.wav", "sfx/pickup.wav", "sfx/level-up.wav",
    "sfx/victory.wav", "sfx/defeat.wav", "sfx/danger.wav"
  ];
  var totalBytes = 0;
  files.forEach(function (name) {
    var data = fs.readFileSync(path.join(root, name));
    totalBytes += data.length;
    assert.equal(data.toString("ascii", 0, 4), "RIFF");
    assert.equal(data.toString("ascii", 8, 12), "WAVE");
  });
  assert.ok(totalBytes < 1024 * 1024);
});
