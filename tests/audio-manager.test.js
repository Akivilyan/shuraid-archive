"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var AudioManager = require("../src/audio/audio-manager");

function makeAudioContext() {
  return {
    src: "",
    volume: 0,
    plays: 0,
    stops: 0,
    pauses: 0,
    play: function () { this.plays += 1; },
    stop: function () { this.stops += 1; },
    pause: function () { this.pauses += 1; }
  };
}

function makeWx() {
  return {
    contexts: [],
    createInnerAudioContext: function () {
      var context = makeAudioContext();
      this.contexts.push(context);
      return context;
    }
  };
}

test("music waits for a user gesture and crossfades between battle moods", function () {
  var wxApi = makeWx();
  var audio = new AudioManager(wxApi);
  audio.setMusic("calm");
  assert.equal(audio.currentMusic, null);
  audio.unlock();
  assert.equal(audio.currentMusic, "calm");
  assert.equal(audio.musicContexts[0].plays, 1);
  audio.setMusic("heroic");
  assert.equal(audio.currentMusic, "heroic");
  audio.update(0.75);
  assert.equal(audio.musicContexts[0].stops >= 1, true);
  assert.equal(audio.musicContexts[1].volume > 0.3, true);
});

test("sound effects are throttled and respect the sound toggle", function () {
  var audio = new AudioManager(makeWx());
  audio.unlock();
  audio.play("enemy-hit");
  var firstPlays = audio.soundPools["enemy-hit"][0].plays;
  audio.play("enemy-hit");
  assert.equal(audio.soundPools["enemy-hit"][0].plays, firstPlays);
  audio.update(0.06);
  audio.play("enemy-hit");
  assert.equal(audio.soundPools["enemy-hit"][1].plays, 1);
  audio.setSoundEnabled(false);
  audio.update(1);
  audio.play("enemy-hit");
  assert.equal(audio.soundPools["enemy-hit"][2].plays, 0);
});
