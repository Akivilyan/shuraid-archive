"use strict";

var World = require("../core/world");
var TouchController = require("../input/touch-controller");
var Renderer = require("../render/renderer");
var AudioManager = require("../audio/audio-manager");

function loadImage(path) {
  var image = wx.createImage();
  image.src = path;
  return image;
}

function WeChatGame() {
  var system = wx.getSystemInfoSync();
  this.width = system.screenWidth;
  this.height = system.screenHeight;
  this.pixelRatio = Math.min(system.pixelRatio || 1, 2);
  var safeTop = system.safeArea && system.safeArea.top ? system.safeArea.top : 0;
  var safeBottom = system.safeArea && system.safeArea.bottom
    ? Math.max(0, this.height - system.safeArea.bottom)
    : 0;
  var menuBottom = 0;
  if (wx.getMenuButtonBoundingClientRect) {
    try {
      var menuRect = wx.getMenuButtonBoundingClientRect();
      menuBottom = menuRect && menuRect.bottom ? menuRect.bottom + 4 : 0;
    } catch (error) {
      menuBottom = 0;
    }
  }
  this.safeTop = Math.max(safeTop, menuBottom);
  this.safeBottom = safeBottom;
  this.playTop = this.safeTop + 66;
  this.canvas = wx.createCanvas();
  this.canvas.width = this.width * this.pixelRatio;
  this.canvas.height = this.height * this.pixelRatio;
  this.context = this.canvas.getContext("2d");
  this.context.scale(this.pixelRatio, this.pixelRatio);
  this.world = new World(this.width, this.height, null, { topEdge: this.playTop });
  this.pushedStoveImage = loadImage("assets/runtime/pushed-stove-atlas.png");
  this.headCookImage = loadImage("assets/runtime/head-cook-atlas.png");
  this.potLidGuardImage = loadImage("assets/runtime/pot-lid-guard-atlas.png");
  this.bunThrowerImage = loadImage("assets/runtime/bun-thrower-atlas.png");
  this.guanImage = loadImage("assets/runtime/guan-atlas.png");
  this.zhugeImage = loadImage("assets/runtime/zhuge-atlas.png");
  this.huangShowcaseImage = loadImage("assets/runtime/huang-showcase-v1.jpg");
  this.renderer = new Renderer(this.context, this.width, this.height, {
    safeTop: this.safeTop,
    safeBottom: this.safeBottom,
    playTop: this.playTop,
    enemyAtlases: {
      pushedStove: this.pushedStoveImage,
      headCook: this.headCookImage,
      potLidGuard: this.potLidGuardImage,
      bunThrower: this.bunThrowerImage
    },
    heroAtlases: { guan: this.guanImage, zhuge: this.zhugeImage },
    heroShowcases: { huang: this.huangShowcaseImage }
  });
  this.screen = "home";
  this.previousScreen = "home";
  this.settings = { vibration: true, music: true, sound: true };
  this.audio = new AudioManager(wx);
  this.lowHealthDanger = false;
  this.homeImage = loadImage("assets/ui/home-cartoon-v1.jpg");

  var self = this;
  this.input = new TouchController(wx, function (x, y) {
    self.audio.unlock();
    if (self.screen === "home" || self.screen === "hero") {
      var topAction = self.renderer.getTopActionAt(x, y);
      if (topAction === "settings") {
        self.previousScreen = self.screen;
        self.screen = "settings";
        return false;
      }
      var navAction = self.renderer.getBottomNavActionAt(x, y);
      if (navAction !== "none") {
        self.screen = navAction;
        return false;
      }
      if (self.screen === "home" && self.renderer.getHomeActionAt(x, y) === "start") {
        self.world.reset();
        self.lowHealthDanger = false;
        self.screen = "battle";
        return true;
      }
      if (self.screen === "hero") {
        var heroAction = self.renderer.getHeroActionAt(x, y);
        if (heroAction !== "none") {
          self.world.setHero(heroAction);
        }
      }
      return false;
    }
    if (self.screen === "settings") {
      var settingsAction = self.renderer.getSettingsActionAt(x, y);
      if (settingsAction === "vibration") {
        self.settings.vibration = !self.settings.vibration;
      } else if (settingsAction === "music") {
        self.settings.music = !self.settings.music;
        self.audio.setMusicEnabled(self.settings.music);
      } else if (settingsAction === "sound") {
        self.settings.sound = !self.settings.sound;
        self.audio.setSoundEnabled(self.settings.sound);
      } else if (settingsAction === "back") {
        self.screen = self.previousScreen || "home";
      }
      return false;
    }
    if (self.world.state === "choosing") {
      var offerIndex = self.renderer.getOfferIndexAt(x, y, self.world.offers.length);
      if (offerIndex >= 0) {
        self.world.chooseSkill(self.world.offers[offerIndex].id);
      }
      return false;
    }
    if (self.world.state === "won" || self.world.state === "lost") {
      self.screen = "home";
      return false;
    }
    return true;
  });
  this.lastTime = 0;
  this.lastImpactSerial = 0;
  if (wx.onHide) { wx.onHide(function () { self.audio.suspend(); }); }
  if (wx.onShow) { wx.onShow(function () { self.audio.resume(); }); }
}

WeChatGame.prototype.start = function () {
  var self = this;
  function frame(timestamp) {
    if (!self.lastTime) { self.lastTime = timestamp; }
    var dt = (timestamp - self.lastTime) / 1000;
    self.lastTime = timestamp;
    if (self.screen === "battle") {
      self.world.update(dt, self.input.getDirection());
    }
    var musicMode = "calm";
    if (self.screen === "battle") {
      var healthRatio = self.world.player.maxHealth > 0
        ? self.world.player.health / self.world.player.maxHealth
        : 0;
      if (healthRatio < 0.3) { self.lowHealthDanger = true; }
      // Leave a small recovery gap so healing around 30% does not make the music flicker.
      if (healthRatio >= 0.36) { self.lowHealthDanger = false; }
      musicMode = self.world.bossSpawned || self.lowHealthDanger
        ? "danger"
        : self.world.elapsed >= 36 ? "heroic" : "calm";
    } else {
      self.lowHealthDanger = false;
    }
    self.audio.setMusic(musicMode);
    var audioEvents = self.world.consumeAudioEvents();
    for (var eventIndex = 0; eventIndex < audioEvents.length; eventIndex += 1) {
      self.audio.play(audioEvents[eventIndex]);
    }
    self.audio.update(Math.min(dt, 0.05));
    if (self.world.impactSerial !== self.lastImpactSerial) {
      self.lastImpactSerial = self.world.impactSerial;
      if (self.settings.vibration && wx.vibrateShort) {
        try {
          wx.vibrateShort({ type: "medium" });
        } catch (error) {
          // Visual feedback remains available on devices without vibration.
        }
      }
    }
    self.renderer.render(self.world, self.input.getVisualState(), {
      screen: self.screen,
      homeImage: self.homeImage,
      settings: self.settings,
      elapsed: timestamp / 1000
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};

module.exports = WeChatGame;
