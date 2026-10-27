"use strict";

var MUSIC_VOLUME = 0.34;
var MUSIC_TRACKS = {
  calm: "assets/audio/bgm/calm.wav",
  heroic: "assets/audio/bgm/heroic.wav",
  danger: "assets/audio/bgm/danger.wav"
};
var SOUND_DEFINITIONS = {
  attack: { path: "assets/audio/sfx/attack.wav", volume: 0.38, cooldown: 0.08, voices: 2 },
  shot: { path: "assets/audio/sfx/shot.wav", volume: 0.34, cooldown: 0.1, voices: 2 },
  "enemy-hit": { path: "assets/audio/sfx/enemy-hit.wav", volume: 0.42, cooldown: 0.055, voices: 3 },
  "player-hit": { path: "assets/audio/sfx/player-hit.wav", volume: 0.58, cooldown: 0.22, voices: 1 },
  pickup: { path: "assets/audio/sfx/pickup.wav", volume: 0.28, cooldown: 0.08, voices: 2 },
  "level-up": { path: "assets/audio/sfx/level-up.wav", volume: 0.5, cooldown: 0.4, voices: 1 },
  victory: { path: "assets/audio/sfx/victory.wav", volume: 0.58, cooldown: 0.6, voices: 1 },
  defeat: { path: "assets/audio/sfx/defeat.wav", volume: 0.58, cooldown: 0.6, voices: 1 },
  danger: { path: "assets/audio/sfx/danger.wav", volume: 0.5, cooldown: 0.8, voices: 1 }
};

function createContext(wxApi, loop) {
  var context = wxApi.createInnerAudioContext();
  context.autoplay = false;
  context.loop = !!loop;
  context.obeyMuteSwitch = true;
  context.volume = 0;
  return context;
}

function AudioManager(wxApi) {
  this.wx = wxApi;
  this.available = !!(wxApi && wxApi.createInnerAudioContext);
  this.unlocked = false;
  this.suspended = false;
  this.musicEnabled = true;
  this.soundEnabled = true;
  this.desiredMusic = "calm";
  this.currentMusic = null;
  this.activeMusicIndex = -1;
  this.musicContexts = [];
  this.fade = null;
  this.soundPools = {};
  this.soundIndexes = {};
  this.cooldowns = {};
  if (!this.available) { return; }

  this.musicContexts = [createContext(wxApi, true), createContext(wxApi, true)];
  var names = Object.keys(SOUND_DEFINITIONS);
  for (var nameIndex = 0; nameIndex < names.length; nameIndex += 1) {
    var name = names[nameIndex];
    var definition = SOUND_DEFINITIONS[name];
    var pool = [];
    for (var voice = 0; voice < definition.voices; voice += 1) {
      var context = createContext(wxApi, false);
      context.src = definition.path;
      context.volume = definition.volume;
      pool.push(context);
    }
    this.soundPools[name] = pool;
    this.soundIndexes[name] = 0;
    this.cooldowns[name] = 0;
  }
}

AudioManager.prototype.unlock = function () {
  if (this.unlocked) { return; }
  this.unlocked = true;
  this.startMusic(this.desiredMusic);
};

AudioManager.prototype.setMusic = function (mode) {
  if (!MUSIC_TRACKS[mode]) { mode = "calm"; }
  this.desiredMusic = mode;
  if (this.unlocked && this.musicEnabled && mode !== this.currentMusic) {
    this.startMusic(mode);
  }
};

AudioManager.prototype.startMusic = function (mode) {
  if (!this.available || !this.unlocked || !this.musicEnabled || this.suspended) { return; }
  if (mode === this.currentMusic && this.activeMusicIndex >= 0) { return; }
  var previousIndex = this.activeMusicIndex;
  var nextIndex = previousIndex < 0 ? 0 : 1 - previousIndex;
  var next = this.musicContexts[nextIndex];
  next.stop();
  next.src = MUSIC_TRACKS[mode];
  next.loop = true;
  next.volume = previousIndex < 0 ? MUSIC_VOLUME : 0;
  next.play();
  this.activeMusicIndex = nextIndex;
  this.currentMusic = mode;
  if (previousIndex >= 0) {
    this.fade = { from: previousIndex, to: nextIndex, elapsed: 0, duration: 0.75 };
  } else {
    this.fade = null;
  }
};

AudioManager.prototype.update = function (dt) {
  var names = Object.keys(this.cooldowns);
  for (var index = 0; index < names.length; index += 1) {
    var name = names[index];
    this.cooldowns[name] = Math.max(0, this.cooldowns[name] - dt);
  }
  if (!this.fade) { return; }
  this.fade.elapsed += dt;
  var ratio = Math.min(1, this.fade.elapsed / this.fade.duration);
  this.musicContexts[this.fade.from].volume = MUSIC_VOLUME * (1 - ratio);
  this.musicContexts[this.fade.to].volume = MUSIC_VOLUME * ratio;
  if (ratio >= 1) {
    this.musicContexts[this.fade.from].stop();
    this.fade = null;
  }
};

AudioManager.prototype.play = function (name) {
  var definition = SOUND_DEFINITIONS[name];
  if (!definition || !this.available || !this.unlocked || !this.soundEnabled || this.suspended) { return; }
  if (this.cooldowns[name] > 0) { return; }
  var pool = this.soundPools[name];
  var index = this.soundIndexes[name] % pool.length;
  var context = pool[index];
  context.stop();
  context.volume = definition.volume;
  context.play();
  this.soundIndexes[name] = index + 1;
  this.cooldowns[name] = definition.cooldown;
};

AudioManager.prototype.setMusicEnabled = function (enabled) {
  this.musicEnabled = !!enabled;
  if (!this.available) { return; }
  if (!this.musicEnabled) {
    for (var index = 0; index < this.musicContexts.length; index += 1) {
      this.musicContexts[index].stop();
    }
    this.currentMusic = null;
    this.activeMusicIndex = -1;
    this.fade = null;
  } else if (this.unlocked) {
    this.startMusic(this.desiredMusic);
  }
};

AudioManager.prototype.setSoundEnabled = function (enabled) {
  this.soundEnabled = !!enabled;
  if (this.soundEnabled || !this.available) { return; }
  var names = Object.keys(this.soundPools);
  for (var nameIndex = 0; nameIndex < names.length; nameIndex += 1) {
    var pool = this.soundPools[names[nameIndex]];
    for (var voice = 0; voice < pool.length; voice += 1) { pool[voice].stop(); }
  }
};

AudioManager.prototype.suspend = function () {
  this.suspended = true;
  if (!this.available) { return; }
  for (var index = 0; index < this.musicContexts.length; index += 1) {
    this.musicContexts[index].pause();
  }
};

AudioManager.prototype.resume = function () {
  this.suspended = false;
  if (this.available && this.unlocked && this.musicEnabled && this.activeMusicIndex >= 0) {
    this.musicContexts[this.activeMusicIndex].play();
  } else if (this.unlocked && this.musicEnabled) {
    this.startMusic(this.desiredMusic);
  }
};

module.exports = AudioManager;
