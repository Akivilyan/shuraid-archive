"use strict";

var config = require("../config");
var rig = require("./character-rig");

function Renderer(context, width, height, options) {
  this.context = context;
  this.width = width;
  this.height = height;
  this.safeTop = options.safeTop || 0;
  this.safeBottom = options.safeBottom || 0;
  this.playTop = options.playTop || 74;
  this.enemyAtlases = options.enemyAtlases || {};
  this.heroAtlases = options.heroAtlases || {};
  this.heroShowcases = options.heroShowcases || {};
}

function roundedRect(ctx, x, y, width, height, radius) {
  var r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

Renderer.prototype.render = function (world, joystick, ui) {
  if (ui && ui.screen !== "battle") {
    this.drawHomeBase(ui.homeImage);
    if (ui.screen === "settings") {
      this.drawSettingsScreen(ui.settings);
    } else {
      this.drawShellHeader();
      if (ui.screen === "hero") { this.drawHeroScreen(world.heroId, ui.elapsed || 0); }
      else { this.drawHomeScreen(world, ui.elapsed || 0); }
      this.drawBottomNav(ui.screen === "hero" ? "hero" : "home");
    }
    return;
  }
  var ctx = this.context;
  ctx.clearRect(0, 0, this.width, this.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, this.playTop, this.width, this.height - this.playTop);
  ctx.clip();
  ctx.translate(0, this.playTop);
  var camera = world.getCamera();
  ctx.translate(-camera.x, -camera.y);
  this.drawGround(camera, world);
  this.drawFireZones(world.fireZones);
  this.drawOrbs(world.orbs);
  this.drawProjectiles(world.projectiles, world.enemyShots);
  this.drawEnemies(world.enemies);
  this.drawPlayer(world.player, world.elapsed);
  this.drawSlashes(world.slashes);
  this.drawHitEffects(world.hitEffects);
  ctx.restore();
  this.drawHud(world);
  if (world.state === "playing") { this.drawJoystick(joystick); }
  if (world.state === "choosing") { this.drawChoices(world); }
  if (world.state === "intro" || world.state === "won" || world.state === "lost") {
    this.drawOverlay(world);
  }
};

Renderer.prototype.drawHomeBase = function (image) {
  var ctx = this.context;
  ctx.clearRect(0, 0, this.width, this.height);
  ctx.fillStyle = "#8edb63";
  ctx.fillRect(0, 0, this.width, this.height);
  if (image && image.width > 0) {
    var imageRatio = image.width / image.height;
    var screenRatio = this.width / this.height;
    var sourceX = 0;
    var sourceY = 0;
    var sourceWidth = image.width;
    var sourceHeight = image.height;
    if (imageRatio > screenRatio) {
      sourceWidth = image.height * screenRatio;
      sourceX = (image.width - sourceWidth) / 2;
    } else {
      sourceHeight = image.width / screenRatio;
      sourceY = (image.height - sourceHeight) / 2;
    }
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, this.width, this.height);
  }
};

Renderer.prototype.drawHeroPortrait = function (heroId, x, baselineY, height, selected, elapsed) {
  var ctx = this.context;
  var lift = selected ? -3 + Math.sin(elapsed * 7) * 1.5 : 0;
  var ringPulse = selected ? 1 + Math.sin(elapsed * 7) * 0.025 : 1;
  ctx.save();
  ctx.translate(x, baselineY + lift);
  ctx.scale(ringPulse, ringPulse);
  ctx.fillStyle = selected ? "rgba(255, 224, 116, 0.54)" : "rgba(255, 250, 226, 0.42)";
  ctx.strokeStyle = selected ? "rgba(210, 139, 25, 0.92)" : "rgba(121, 96, 61, 0.28)";
  ctx.lineWidth = selected ? 3 : 2;
  ctx.beginPath();
  ctx.arc(0, -height * 0.43, height * 0.48, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.scale(height / 80, height / 80);
  this.drawPlayer({
    x: 0,
    y: 0,
    facing: { x: 1, y: 0 },
    heroId: heroId,
    moving: false,
    walkTime: 0,
    actionTime: selected ? (heroId === "zhuge" ? 0.16 : 0.09) : 0,
    hurtTime: 0,
    invulnerable: 0
  }, elapsed);
  ctx.restore();
};

Renderer.prototype.drawHeroShowcase = function (heroId, x, y, width, height, radius) {
  var image = this.heroShowcases[heroId];
  if (!image || !image.width || !image.height) { return false; }
  var sourceRatio = image.width / image.height;
  var targetRatio = width / height;
  var sourceX = 0;
  var sourceY = 0;
  var sourceWidth = image.width;
  var sourceHeight = image.height;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }
  var ctx = this.context;
  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  ctx.restore();
  return true;
};

Renderer.prototype.drawHomeScreen = function (world, elapsed) {
  var ctx = this.context;
  var layout = this.getShellLayout();
  var panelX = 20;
  var panelY = layout.contentTop + 8;
  var panelWidth = this.width - 40;
  var buttonHeight = 60;
  var buttonY = layout.contentBottom - buttonHeight - 14;
  var panelHeight = buttonY - panelY - 14;

  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 26);
  ctx.fillStyle = "rgba(255, 249, 221, 0.97)"; ctx.fill();
  var hasShowcase = this.drawHeroShowcase(world.hero.id, panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8, 22);
  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 26);
  ctx.strokeStyle = "#d58c19"; ctx.lineWidth = 4; ctx.stroke();
  roundedRect(ctx, panelX + 7, panelY + 7, panelWidth - 14, panelHeight - 14, 20);
  ctx.strokeStyle = "rgba(255, 214, 104, 0.9)"; ctx.lineWidth = 2; ctx.stroke();

  if (hasShowcase) {
    roundedRect(ctx, panelX + 12, panelY + 12, panelWidth - 24, 94, 16);
    ctx.fillStyle = "rgba(57, 39, 20, 0.5)"; ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = hasShowcase ? "#ffeaa0" : "#8b4c11";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("第一关 · 粮道奇袭", this.width / 2, panelY + 34);
  ctx.fillStyle = hasShowcase ? "#fffaf0" : "#3e3425";
  ctx.font = "bold 27px sans-serif";
  ctx.fillText("夜袭敌军粮道", this.width / 2, panelY + 68);
  ctx.fillStyle = hasShowcase ? "#fff2c7" : "#7b6646";
  ctx.font = "14px sans-serif";
  ctx.fillText("预计 5 分钟  ·  自动攻击", this.width / 2, panelY + 94);

  if (!hasShowcase) {
    var portraitHeight = Math.min(206, panelHeight * 0.54);
    this.drawHeroPortrait(world.hero.id, this.width / 2, panelY + panelHeight - 52, portraitHeight, false, elapsed);
  }
  roundedRect(ctx, panelX + 54, panelY + panelHeight - 54, panelWidth - 108, 40, 18);
  ctx.fillStyle = "rgba(75, 53, 31, 0.9)"; ctx.fill();
  ctx.fillStyle = "#fff8d8";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(world.hero.name + " · " + world.hero.className, this.width / 2, panelY + panelHeight - 28);

  roundedRect(ctx, panelX + 4, buttonY, panelWidth - 8, buttonHeight, 26);
  ctx.fillStyle = "#ffc52f"; ctx.fill();
  ctx.strokeStyle = "#8f4d0c"; ctx.lineWidth = 4; ctx.stroke();
  roundedRect(ctx, panelX + 10, buttonY + 6, panelWidth - 20, buttonHeight - 16, 20);
  ctx.strokeStyle = "rgba(255, 246, 164, 0.96)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#713600";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("出阵劫粮", this.width / 2, buttonY + 39);
};

Renderer.prototype.getHomeActionAt = function (x, y) {
  var layout = this.getShellLayout();
  if (x >= 20 && x <= this.width - 20 && y >= layout.contentBottom - 80 && y <= layout.contentBottom - 8) {
    return "start";
  }
  return "none";
};

Renderer.prototype.getShellLayout = function () {
  var navHeight = 76;
  var navY = this.height - this.safeBottom - navHeight;
  return {
    headerY: this.safeTop + 6,
    headerHeight: 52,
    contentTop: this.safeTop + 64,
    contentBottom: navY - 10,
    navY: navY,
    navHeight: navHeight
  };
};

Renderer.prototype.drawShellHeader = function () {
  var ctx = this.context;
  var layout = this.getShellLayout();
  ctx.textAlign = "left";
  ctx.font = "bold 23px sans-serif";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255, 249, 218, 0.98)";
  ctx.strokeText("报，蜀军来劫粮", 18, layout.headerY + 34);
  ctx.fillStyle = "#3d793f";
  ctx.fillText("报，蜀军来劫粮", 18, layout.headerY + 34);

  roundedRect(ctx, this.width - 58, layout.headerY + 2, 48, 48, 20);
  ctx.fillStyle = "rgba(72, 59, 42, 0.84)"; ctx.fill();
  ctx.strokeStyle = "rgba(255, 244, 197, 0.92)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff8d8";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("设置", this.width - 34, layout.headerY + 32);
};

Renderer.prototype.getTopActionAt = function (x, y) {
  var layout = this.getShellLayout();
  if (x >= this.width - 64 && x <= this.width - 4 && y >= layout.headerY && y <= layout.headerY + 52) {
    return "settings";
  }
  return "none";
};

Renderer.prototype.drawBottomNav = function (activeScreen) {
  var ctx = this.context;
  var layout = this.getShellLayout();
  var items = [
    { label: "军需", glyph: "囊", locked: true },
    { label: "武将", glyph: "将", screen: "hero" },
    { label: "劫粮", glyph: "粮", screen: "home" },
    { label: "战报", glyph: "报", locked: true },
    { label: "军略", glyph: "略", locked: true }
  ];
  var cellWidth = this.width / items.length;
  ctx.fillStyle = "rgba(255, 246, 210, 0.98)";
  ctx.fillRect(0, layout.navY, this.width, layout.navHeight + this.safeBottom);
  ctx.strokeStyle = "#c77a16";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, layout.navY); ctx.lineTo(this.width, layout.navY); ctx.stroke();

  for (var index = 0; index < items.length; index += 1) {
    var item = items[index];
    var centerX = cellWidth * (index + 0.5);
    var active = item.screen === activeScreen;
    var iconY = layout.navY + 26;
    if (index === 2) {
      ctx.beginPath();
      ctx.arc(centerX, layout.navY + 18, 32, 0, Math.PI * 2);
      ctx.fillStyle = active ? "#ffc32d" : "#f0ba38"; ctx.fill();
      ctx.strokeStyle = "#94510d"; ctx.lineWidth = 4; ctx.stroke();
      iconY = layout.navY + 24;
    } else if (active) {
      roundedRect(ctx, centerX - 31, layout.navY + 7, 62, 50, 18);
      ctx.fillStyle = "#66bfe4"; ctx.fill();
      ctx.strokeStyle = "#326b86"; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = item.locked ? "#9c927e" : active ? "#57320b" : "#5d4b32";
    ctx.fillText(item.glyph, centerX, iconY);
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(item.label, centerX, layout.navY + 67);
    if (item.locked) {
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#a79b85";
      ctx.fillText("未开", centerX, layout.navY + 44);
    } else if (active && index !== 2) {
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText("当前", centerX, layout.navY + 48);
    }
  }
};

Renderer.prototype.getBottomNavActionAt = function (x, y) {
  var layout = this.getShellLayout();
  if (x < 0 || x > this.width || y < layout.navY - 14 || y > this.height) { return "none"; }
  var index = Math.floor(x / (this.width / 5));
  if (index === 1) { return "hero"; }
  if (index === 2) { return "home"; }
  return "none";
};

Renderer.prototype.drawPanelShade = function () {
  this.context.fillStyle = "rgba(54, 38, 25, 0.42)";
  this.context.fillRect(0, 0, this.width, this.height);
};

Renderer.prototype.getHeroLayout = function () {
  var shell = this.getShellLayout();
  var panelY = shell.contentTop + 8;
  var panelHeight = shell.contentBottom - panelY - 8;
  var choiceTop = panelY + panelHeight - 124;
  return {
    x: 18,
    y: panelY,
    width: this.width - 36,
    height: panelHeight,
    portraitBottom: Math.min(panelY + Math.min(348, panelHeight * 0.62), choiceTop - 78),
    choiceTop: choiceTop,
    choiceHeight: 112,
    choiceGap: 8
  };
};

Renderer.prototype.getHeroCards = function () {
  return [
    { id: "guan", name: "关羽", type: "长兵", color: "#39a957", note: "近身横扫" },
    { id: "huang", name: "黄忠", type: "弓箭", color: "#d68721", note: "远程箭矢" },
    { id: "zhuge", name: "诸葛亮", type: "法术", color: "#5485cf", note: "闪电与阵法" }
  ];
};

Renderer.prototype.drawHeroScreen = function (selectedHeroId, elapsed) {
  var ctx = this.context;
  var layout = this.getHeroLayout();
  var x = layout.x;
  var y = layout.y;
  var width = layout.width;
  var height = layout.height;
  roundedRect(ctx, x, y, width, height, 24);
  ctx.fillStyle = "rgba(255, 248, 218, 0.97)"; ctx.fill();
  var showcaseHeight = layout.choiceTop - y - 10;
  var hasShowcase = this.drawHeroShowcase(selectedHeroId, x + 4, y + 4, width - 8, showcaseHeight, 20);
  roundedRect(ctx, x, y, width, height, 24);
  ctx.strokeStyle = "#d58c19"; ctx.lineWidth = 4; ctx.stroke();
  var cards = this.getHeroCards();
  var selectedCard = cards[0];
  for (var selectedIndex = 0; selectedIndex < cards.length; selectedIndex += 1) {
    if (cards[selectedIndex].id === selectedHeroId) { selectedCard = cards[selectedIndex]; }
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#80501d";
  ctx.font = "bold 15px sans-serif";
  if (hasShowcase) {
    roundedRect(ctx, this.width / 2 - 76, y + 10, 152, 32, 15);
    ctx.fillStyle = "rgba(52, 36, 19, 0.66)"; ctx.fill();
    ctx.fillStyle = "#fff0b3";
  }
  ctx.fillText("当前出阵武将", this.width / 2, y + 30);
  if (!hasShowcase) {
    this.drawHeroPortrait(selectedHeroId, this.width / 2, layout.portraitBottom - 18, Math.min(216, height * 0.42), true, elapsed);
  } else {
    roundedRect(ctx, x + 40, layout.portraitBottom - 12, width - 80, 84, 20);
    ctx.fillStyle = "rgba(43, 30, 18, 0.72)"; ctx.fill();
  }
  ctx.fillStyle = hasShowcase ? "#fff9e8" : "#40301f";
  ctx.font = "bold 25px sans-serif";
  ctx.fillText(selectedCard.name, this.width / 2, layout.portraitBottom + 12);
  ctx.fillStyle = hasShowcase ? "#ffe071" : selectedCard.color;
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(selectedCard.type + " · " + selectedCard.note, this.width / 2, layout.portraitBottom + 38);
  ctx.fillStyle = hasShowcase ? "#fff0c6" : "#7b684b";
  ctx.font = "14px sans-serif";
  ctx.fillText("点击下方武将即可立即换将", this.width / 2, layout.portraitBottom + 64);

  var cardWidth = (width - 32 - layout.choiceGap * 2) / 3;
  for (var index = 0; index < cards.length; index += 1) {
    var card = cards[index];
    var selected = card.id === selectedHeroId;
    var cardX = x + 16 + index * (cardWidth + layout.choiceGap);
    var cardY = layout.choiceTop;
    var selectedLift = selected ? -2 : 0;
    roundedRect(ctx, cardX, cardY + selectedLift, cardWidth, layout.choiceHeight, 18);
    ctx.fillStyle = selected ? "#fff0a8" : "#fffaf0"; ctx.fill();
    ctx.strokeStyle = selected ? "#c98513" : "#d7c89b"; ctx.lineWidth = selected ? 4 : 2; ctx.stroke();
    if (selected) {
      roundedRect(ctx, cardX + 5, cardY + selectedLift + 5, cardWidth - 10, layout.choiceHeight - 10, 13);
      ctx.strokeStyle = "rgba(255, 255, 234, 0.92)"; ctx.lineWidth = 2; ctx.stroke();
    }
    var hasThumbnail = this.drawHeroShowcase(card.id, cardX + cardWidth / 2 - 29, cardY + 10 + selectedLift, 58, 58, 29);
    if (!hasThumbnail) {
      this.drawHeroPortrait(card.id, cardX + cardWidth / 2, cardY + 70 + selectedLift, 58, false, elapsed);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#4b351f";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(card.name, cardX + cardWidth / 2, cardY + 86 + selectedLift);
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = selected ? "#9a5f0b" : card.color;
    ctx.fillText(selected ? "当前" : card.type, cardX + cardWidth / 2, cardY + 105 + selectedLift);
  }
};

Renderer.prototype.getHeroActionAt = function (x, y) {
  var layout = this.getHeroLayout();
  var cardWidth = (layout.width - 32 - layout.choiceGap * 2) / 3;
  if (y < layout.choiceTop - 6 || y > layout.choiceTop + layout.choiceHeight + 6) { return "none"; }
  for (var index = 0; index < 3; index += 1) {
    var cardX = layout.x + 16 + index * (cardWidth + layout.choiceGap);
    if (x >= cardX - 3 && x <= cardX + cardWidth + 3) { return ["guan", "huang", "zhuge"][index]; }
  }
  return "none";
};

Renderer.prototype.drawSettingsScreen = function (settings) {
  var ctx = this.context;
  this.drawPanelShade();
  var x = 30;
  var y = Math.max(this.safeTop + 70, this.height * 0.22);
  var width = this.width - 60;
  var height = 390;
  roundedRect(ctx, x, y, width, height, 26);
  ctx.fillStyle = "rgba(255, 248, 218, 0.98)"; ctx.fill();
  ctx.strokeStyle = "#e6a928"; ctx.lineWidth = 5; ctx.stroke();
  ctx.textAlign = "center"; ctx.fillStyle = "#4b351f"; ctx.font = "bold 26px sans-serif"; ctx.fillText("设置", this.width / 2, y + 48);
  roundedRect(ctx, x + 24, y + 78, width - 48, 58, 22);
  ctx.fillStyle = settings.vibration ? "#58b966" : "#b9b39f"; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 17px sans-serif"; ctx.fillText("战斗振动：" + (settings.vibration ? "开" : "关"), this.width / 2, y + 114);

  roundedRect(ctx, x + 24, y + 145, width - 48, 58, 22);
  ctx.fillStyle = settings.music ? "#58b966" : "#b9b39f"; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText("背景音乐：" + (settings.music ? "开" : "关"), this.width / 2, y + 181);

  roundedRect(ctx, x + 24, y + 212, width - 48, 58, 22);
  ctx.fillStyle = settings.sound ? "#58b966" : "#b9b39f"; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText("战斗音效：" + (settings.sound ? "开" : "关"), this.width / 2, y + 248);

  roundedRect(ctx, x + 24, y + 300, width - 48, 54, 22);
  ctx.fillStyle = "#62bde3"; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText("返回营地", this.width / 2, y + 334);
};

Renderer.prototype.getSettingsActionAt = function (x, y) {
  var panelY = Math.max(this.safeTop + 70, this.height * 0.22);
  if (y >= panelY + 72 && y <= panelY + 136) { return "vibration"; }
  if (y >= panelY + 140 && y <= panelY + 203) { return "music"; }
  if (y >= panelY + 208 && y <= panelY + 271) { return "sound"; }
  if (y >= panelY + 292 && y <= panelY + 360) { return "back"; }
  return "none";
};

Renderer.prototype.drawGround = function (camera, world) {
  var ctx = this.context;
  ctx.fillStyle = "#75b74c";
  ctx.fillRect(camera.x, camera.y, camera.width, camera.height);
  ctx.fillStyle = config.colors.ground;
  ctx.fillRect(0, 0, world.mapWidth, world.mapHeight);
  ctx.strokeStyle = config.colors.grid;
  ctx.lineWidth = 1;
  var grid = 88;
  var startX = Math.max(0, Math.floor(camera.x / grid) * grid);
  var endX = Math.min(world.mapWidth, camera.x + camera.width);
  var startY = Math.max(0, Math.floor(camera.y / grid) * grid);
  var endY = Math.min(world.mapHeight, camera.y + camera.height);
  for (var x = startX; x <= endX; x += grid) {
    ctx.beginPath(); ctx.arc(x, startY + 24, 22, 0, Math.PI * 2); ctx.stroke();
  }
  for (var y = startY; y <= endY; y += grid) {
    ctx.beginPath(); ctx.arc(startX + 38, y, 13, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = "#5c983e";
  ctx.lineWidth = 7;
  ctx.strokeRect(0, 0, world.mapWidth, world.mapHeight);
};

Renderer.prototype.drawFireZones = function (zones) {
  var ctx = this.context;
  for (var index = 0; index < zones.length; index += 1) {
    var zone = zones[index];
    ctx.fillStyle = "rgba(221, 83, 39, " + Math.min(0.5, zone.life * 0.32) + ")";
    ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255, 190, 65, 0.8)";
    ctx.lineWidth = 2; ctx.stroke();
  }
};

Renderer.prototype.drawOrbs = function (orbs) {
  var ctx = this.context;
  for (var index = 0; index < orbs.length; index += 1) {
    var orb = orbs[index];
    ctx.fillStyle = config.colors.experience;
    var size = 6 + Math.min(3, orb.value);
    ctx.beginPath(); ctx.moveTo(orb.x, orb.y - size); ctx.lineTo(orb.x + size, orb.y); ctx.lineTo(orb.x, orb.y + size); ctx.lineTo(orb.x - size, orb.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = config.colors.paper; ctx.lineWidth = 2; ctx.stroke();
  }
};

Renderer.prototype.drawProjectiles = function (projectiles, enemyShots) {
  var ctx = this.context;
  for (var index = 0; index < projectiles.length; index += 1) {
    var projectile = projectiles[index];
    if (projectile.kind === "arrow") {
      var angle = Math.atan2(projectile.vy, projectile.vx);
      ctx.save(); ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
      ctx.strokeStyle = "#6b4725"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(9, 0); ctx.stroke();
      ctx.fillStyle = "#ffd34d"; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(86, 218, 166, 0.86)";
      ctx.beginPath(); ctx.ellipse(projectile.x, projectile.y, projectile.radius * 1.45, projectile.radius * 0.65, Math.atan2(projectile.vy, projectile.vx), 0, Math.PI * 2); ctx.fill();
    }
  }
  for (var shotIndex = 0; shotIndex < enemyShots.length; shotIndex += 1) {
    var shot = enemyShots[shotIndex];
    if (shot.kind === "bun") {
      ctx.save(); ctx.translate(shot.x, shot.y);
      ctx.fillStyle = "#fff0c8"; ctx.strokeStyle = "#8d6335"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, shot.radius * 1.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f5d896";
      ctx.beginPath(); ctx.arc(0, -shot.radius * 1.05, shot.radius * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#c99a56"; ctx.lineWidth = 1;
      for (var pleat = -1; pleat <= 1; pleat += 1) {
        ctx.beginPath(); ctx.moveTo(pleat * shot.radius * 0.38, -shot.radius * 0.78); ctx.lineTo(pleat * shot.radius * 0.2, -shot.radius * 0.08); ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = config.colors.danger;
      ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2); ctx.fill();
    }
  }
};

Renderer.prototype.enemyColor = function (type, faction) {
  var wei = { grunt: "#6687b5", runner: "#80a5d1", brute: "#456a9c", archer: "#617aa9", boss: "#354f82" };
  var wu = { grunt: "#c9614f", runner: "#df8b4f", brute: "#a94740", archer: "#b65f70", boss: "#8e343a" };
  var palette = faction === "wu" ? wu : wei;
  return palette[type] || palette.grunt;
};

Renderer.prototype.drawFactionCrest = function (ctx, enemy, radius) {
  if (enemy.faction === "wu") {
    ctx.strokeStyle = "#f6c84d";
    ctx.lineWidth = Math.max(2, radius * 0.14);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.18, -radius * 0.98); ctx.lineTo(-radius * 0.42, -radius * 1.42);
    ctx.moveTo(radius * 0.12, -radius); ctx.lineTo(radius * 0.38, -radius * 1.45);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#dce9f4";
    roundedRect(ctx, -radius * 0.22, -radius * 1.42, radius * 0.44, radius * 0.52, radius * 0.12);
    ctx.fill();
  }
};

Renderer.prototype.getPushedStoveFrame = function (enemy) {
  if (enemy.hitFlash > 0) { return 4; }
  if (enemy.attackTime > 0) { return 3; }
  return 1 + Math.floor(enemy.age * 4) % 2;
};

Renderer.prototype.drawPushedStoveEnemy = function (enemy) {
  var image = this.enemyAtlases.pushedStove;
  if (!image || image.width <= 0) { return false; }
  var ctx = this.context;
  var sourceWidth = 384;
  var sourceHeight = 240;
  var frame = this.getPushedStoveFrame(enemy);
  var drawWidth = enemy.radius * 5.6;
  var drawHeight = drawWidth * sourceHeight / sourceWidth;
  var baseline = enemy.radius * 0.86;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.facingX > 0) { ctx.scale(-1, 1); }
  if (enemy.hitFlash > 0) { ctx.scale(1.08, 0.92); }
  ctx.drawImage(
    image,
    frame * sourceWidth,
    0,
    sourceWidth,
    sourceHeight,
    -drawWidth / 2,
    baseline - drawHeight,
    drawWidth,
    drawHeight
  );
  ctx.restore();
  return true;
};

Renderer.prototype.getKitchenEnemyFrame = function (enemy) {
  if (enemy.hitFlash > 0) { return 5; }
  if (enemy.attackTime > 0) {
    return enemy.attackTime > 0.12 ? 3 : 4;
  }
  return 1 + Math.floor(enemy.age * 4) % 2;
};

Renderer.prototype.drawKitchenEnemy = function (enemy) {
  var atlasKeys = { grunt: "headCook", brute: "potLidGuard", archer: "bunThrower" };
  var drawHeights = { grunt: 60, brute: 72, archer: 64 };
  var image = this.enemyAtlases[atlasKeys[enemy.type]];
  if (!image || image.width <= 0) { return false; }
  var ctx = this.context;
  var sourceSize = 288;
  var frame = this.getKitchenEnemyFrame(enemy);
  var drawHeight = drawHeights[enemy.type];
  var baseline = enemy.radius * 0.92;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.facingX > 0) { ctx.scale(-1, 1); }
  if (enemy.hitFlash > 0) { ctx.scale(1.08, 0.92); }
  ctx.drawImage(
    image,
    frame * sourceSize,
    0,
    sourceSize,
    sourceSize,
    -drawHeight / 2,
    baseline - drawHeight,
    drawHeight,
    drawHeight
  );
  ctx.restore();
  return true;
};

Renderer.prototype.drawEnemyHealthBar = function (enemy, visualRadius) {
  if (enemy.type !== "boss" && enemy.type !== "brute") { return; }
  var ctx = this.context;
  var barWidth = enemy.radius * 2;
  ctx.fillStyle = "rgba(41,35,27,0.5)"; ctx.fillRect(enemy.x - enemy.radius, enemy.y - visualRadius - 13, barWidth, 5);
  ctx.fillStyle = config.colors.danger; ctx.fillRect(enemy.x - enemy.radius, enemy.y - visualRadius - 13, barWidth * Math.max(0, enemy.health / enemy.maxHealth), 5);
};

Renderer.prototype.drawEnemies = function (enemies) {
  var ctx = this.context;
  var ordered = enemies.slice().sort(function (a, b) { return a.y - b.y; });
  for (var index = 0; index < ordered.length; index += 1) {
    var enemy = ordered[index];
    var visualRadius = enemy.radius + (enemy.type === "boss" ? 5 : 3);
    var spriteDrawn = enemy.type === "runner" ? this.drawPushedStoveEnemy(enemy) : this.drawKitchenEnemy(enemy);
    if (spriteDrawn) {
      this.drawEnemyHealthBar(enemy, visualRadius);
      continue;
    }
    var pose = rig.enemyPose(enemy);
    var lunge = pose.attack * 5;
    var aimAngle = Math.atan2(enemy.facingY, enemy.facingX);
    ctx.save(); ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = "rgba(75, 53, 31, 0.18)";
    ctx.beginPath(); ctx.ellipse(0, visualRadius * 0.68, visualRadius * 0.95, visualRadius * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(enemy.facingX * lunge, enemy.facingY * lunge + pose.bob);
    ctx.rotate(pose.bodyTilt);
    if (enemy.hitFlash > 0) { ctx.scale(1.14 + pose.hurt * 0.06, 0.84 - pose.hurt * 0.05); }
    var armor = enemy.hitFlash > 0 ? config.colors.paper : this.enemyColor(enemy.type, enemy.faction);
    var trim = enemy.faction === "wu" ? "#f4c34e" : "#dce8f4";
    rig.drawBone(ctx, -visualRadius * 0.3, visualRadius * 0.38, visualRadius * 0.36, visualRadius * 0.3, Math.PI / 2 + pose.leftLeg, -pose.leftLeg * 0.35, visualRadius * 0.28, "#543a2d", "#fff1cb");
    rig.drawBone(ctx, visualRadius * 0.3, visualRadius * 0.38, visualRadius * 0.36, visualRadius * 0.3, Math.PI / 2 + pose.rightLeg, -pose.rightLeg * 0.35, visualRadius * 0.28, "#543a2d", "#fff1cb");
    if (enemy.type === "boss") {
      rig.drawCape(ctx, 0, visualRadius * 0.2, visualRadius * 1.25, visualRadius * 0.9, -Math.PI / 2 + pose.walk * 0.08, armor, trim);
    }
    ctx.fillStyle = armor;
    roundedRect(ctx, -visualRadius * 0.72, -visualRadius * 0.25, visualRadius * 1.44, visualRadius * 1.15, visualRadius * 0.36); ctx.fill();
    ctx.strokeStyle = trim; ctx.lineWidth = enemy.type === "boss" ? 3.5 : 2.2; ctx.stroke();
    ctx.fillStyle = "#e9b987";
    ctx.beginPath(); ctx.arc(0, -visualRadius * 0.55, visualRadius * 0.58, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = armor;
    ctx.beginPath(); ctx.arc(0, -visualRadius * 0.72, visualRadius * 0.61, Math.PI, Math.PI * 2); ctx.fill();
    this.drawFactionCrest(ctx, enemy, visualRadius);
    ctx.fillStyle = "#4c332b";
    ctx.beginPath(); ctx.arc(-visualRadius * 0.2, -visualRadius * 0.58, 1.7, 0, Math.PI * 2); ctx.arc(visualRadius * 0.2, -visualRadius * 0.58, 1.7, 0, Math.PI * 2); ctx.fill();

    rig.drawBone(ctx, -visualRadius * 0.56, -visualRadius * 0.05, visualRadius * 0.38, visualRadius * 0.32, Math.PI / 2 + pose.rearArm, -0.25, visualRadius * 0.27, armor, trim);
    var enemyHand = rig.drawBone(ctx, visualRadius * 0.56, -visualRadius * 0.05, visualRadius * 0.4, visualRadius * 0.34, Math.PI / 2 + pose.frontArm, 0.25, visualRadius * 0.28, armor, trim);

    if (enemy.type === "brute") {
      ctx.save(); ctx.translate(enemyHand.handX, enemyHand.handY); ctx.rotate(pose.frontArm * 0.25);
      ctx.fillStyle = enemy.faction === "wu" ? "#713a32" : "#314f74";
      roundedRect(ctx, -visualRadius * 0.82, -visualRadius * 0.48, visualRadius * 1.64, visualRadius * 1.06, visualRadius * 0.18); ctx.fill();
      ctx.strokeStyle = trim; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = trim; ctx.font = "bold " + Math.max(10, visualRadius * 0.7) + "px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(enemy.faction === "wu" ? "吴" : "魏", 0, visualRadius * 0.22); ctx.restore();
    } else if (enemy.type === "archer") {
      ctx.save(); ctx.translate(enemyHand.handX, enemyHand.handY); ctx.rotate(aimAngle + Math.PI / 2 + pose.weaponAngle);
      ctx.strokeStyle = "#68462c"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, visualRadius * 0.82, -Math.PI * 0.62, Math.PI * 0.62); ctx.stroke();
      ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(visualRadius * 0.38, -visualRadius * 0.63); ctx.lineTo(visualRadius * 0.38 - pose.attack * visualRadius * 0.35, 0); ctx.lineTo(visualRadius * 0.38, visualRadius * 0.63); ctx.stroke(); ctx.restore();
    } else if (enemy.type === "boss") {
      ctx.fillStyle = trim;
      ctx.beginPath(); ctx.moveTo(-visualRadius * 0.72, -visualRadius * 0.85); ctx.lineTo(-visualRadius * 0.4, -visualRadius * 1.38); ctx.lineTo(0, -visualRadius * 0.92); ctx.lineTo(visualRadius * 0.42, -visualRadius * 1.42); ctx.lineTo(visualRadius * 0.75, -visualRadius * 0.82); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(enemyHand.handX, enemyHand.handY); ctx.rotate(aimAngle + Math.PI / 2 + pose.weaponAngle);
      ctx.strokeStyle = "#5a3b25"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, visualRadius * 0.2); ctx.lineTo(0, -visualRadius * 1.25); ctx.stroke();
      ctx.fillStyle = "#efe0aa"; ctx.beginPath(); ctx.moveTo(0, -visualRadius * 1.55); ctx.lineTo(-visualRadius * 0.24, -visualRadius * 1.12); ctx.lineTo(visualRadius * 0.24, -visualRadius * 1.12); ctx.closePath(); ctx.fill(); ctx.restore();
    } else if (enemy.type === "runner") {
      ctx.fillStyle = trim;
      ctx.beginPath(); ctx.moveTo(-visualRadius * 0.7, -visualRadius * 0.42); ctx.lineTo(-visualRadius * 1.34, -visualRadius * 0.75); ctx.lineTo(-visualRadius * 0.78, visualRadius * 0.08); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(enemyHand.handX, enemyHand.handY); ctx.rotate(aimAngle + Math.PI / 2 + pose.weaponAngle);
      ctx.strokeStyle = "#59402d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -visualRadius * 0.9); ctx.stroke(); ctx.restore();
    } else {
      ctx.save(); ctx.translate(enemyHand.handX, enemyHand.handY); ctx.rotate(aimAngle + Math.PI / 2 + pose.weaponAngle);
      ctx.strokeStyle = "#5d422d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, visualRadius * 0.25); ctx.lineTo(0, -visualRadius * 1.2); ctx.stroke();
      ctx.fillStyle = trim; ctx.beginPath(); ctx.moveTo(0, -visualRadius * 1.42); ctx.lineTo(-visualRadius * 0.24, -visualRadius * 1.04); ctx.lineTo(visualRadius * 0.24, -visualRadius * 1.04); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    this.drawEnemyHealthBar(enemy, visualRadius);
  }
};

Renderer.prototype.getGuanFrame = function (player, pose) {
  if (pose.state === "hurt") { return 5; }
  if (pose.state === "attack") { return pose.frame < 2 ? 3 : 4; }
  if (pose.state === "move") { return 1 + Math.floor(player.walkTime * 4) % 2; }
  return 0;
};

Renderer.prototype.drawGuanPlayer = function (player, pose) {
  var image = this.heroAtlases.guan;
  if (!image || image.width <= 0) { return false; }
  var ctx = this.context;
  var sourceWidth = 384;
  var sourceHeight = 288;
  var frame = this.getGuanFrame(player, pose);
  var drawHeight = 76;
  var drawWidth = drawHeight * sourceWidth / sourceHeight;
  var bodyAnchorX = drawWidth * 230 / sourceWidth;
  var baselineY = 17;

  ctx.save();
  ctx.translate(player.x, player.y + pose.bob);
  ctx.fillStyle = "rgba(75, 53, 31, 0.2)";
  ctx.beginPath(); ctx.ellipse(0, 12, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (player.facing.x < 0) { ctx.scale(-1, 1); }
  ctx.globalAlpha = player.invulnerable > 0 && Math.floor(player.invulnerable * 18) % 2 === 0 ? 0.35 : 1;
  ctx.drawImage(
    image,
    frame * sourceWidth,
    0,
    sourceWidth,
    sourceHeight,
    -bodyAnchorX,
    baselineY - drawHeight * 374 / sourceHeight,
    drawWidth,
    drawHeight
  );
  ctx.restore();
  return true;
};

Renderer.prototype.getZhugeFrame = function (player, pose) {
  if (pose.state === "hurt") { return 5; }
  if (pose.state === "attack") { return pose.frame < 2 ? 3 : 4; }
  if (pose.state === "move") { return 1 + Math.floor(player.walkTime * 4) % 2; }
  return 0;
};

Renderer.prototype.drawZhugePlayer = function (player, pose, elapsed) {
  var image = this.heroAtlases.zhuge;
  if (!image || image.width <= 0) { return false; }
  var ctx = this.context;
  var sourceWidth = 384;
  var sourceHeight = 288;
  var frame = this.getZhugeFrame(player, pose);
  var drawHeight = 80;
  var drawWidth = drawHeight * sourceWidth / sourceHeight;
  var breath = pose.state === "idle" ? Math.sin(elapsed * 3.1) : 0;
  var moveSway = pose.state === "move" ? Math.sin(player.walkTime * 9) : 0;
  var castPulse = pose.state === "attack" ? 0.55 + pose.action * 0.45 : 0;

  ctx.save();
  ctx.translate(player.x, player.y + pose.bob - breath * 0.8);
  ctx.fillStyle = "rgba(42, 75, 68, 0.2)";
  ctx.beginPath(); ctx.ellipse(0, 12, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (castPulse > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.28 + castPulse * 0.2;
    ctx.strokeStyle = "rgba(103, 226, 222, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 7, 24 + castPulse * 7, 9 + castPulse * 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(255, 228, 112, 0.82)";
    ctx.beginPath(); ctx.arc(0, -15, 18 + castPulse * 4, 0, Math.PI * 2); ctx.stroke();
    for (var mote = 0; mote < 3; mote += 1) {
      var moteAngle = elapsed * 5 + mote * Math.PI * 2 / 3;
      ctx.fillStyle = mote % 2 === 0 ? "rgba(116,235,226,0.9)" : "rgba(255,235,145,0.9)";
      ctx.beginPath(); ctx.arc(Math.cos(moteAngle) * 24, -15 + Math.sin(moteAngle) * 13, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.rotate(Math.sin(elapsed * 1.45) * 0.012 + moveSway * 0.025);
  ctx.scale(1 - breath * 0.006, 1 + breath * 0.012 + (pose.state === "move" ? 0.012 : 0));
  if (player.facing.x < 0) { ctx.scale(-1, 1); }
  ctx.globalAlpha = player.invulnerable > 0 && Math.floor(player.invulnerable * 18) % 2 === 0 ? 0.35 : 1;
  ctx.drawImage(
    image,
    frame * sourceWidth,
    0,
    sourceWidth,
    sourceHeight,
    -drawWidth / 2,
    16 - drawHeight,
    drawWidth,
    drawHeight
  );
  ctx.restore();
  return true;
};

Renderer.prototype.drawPlayer = function (player, elapsed) {
  var ctx = this.context;
  var aimAngle = Math.atan2(player.facing.y, player.facing.x);
  var pose = rig.playerPose(player, elapsed);
  if (player.heroId === "guan" && this.drawGuanPlayer(player, pose)) { return; }
  if (player.heroId === "zhuge" && this.drawZhugePlayer(player, pose, elapsed)) { return; }
  ctx.save(); ctx.translate(player.x, player.y + pose.bob); ctx.rotate(pose.bodyTilt); ctx.scale(pose.bodyScaleX, pose.bodyScaleY);
  ctx.globalAlpha = player.invulnerable > 0 && Math.floor(player.invulnerable * 18) % 2 === 0 ? 0.35 : 1;
  ctx.fillStyle = "rgba(75, 53, 31, 0.2)";
  ctx.beginPath(); ctx.ellipse(-2, 9, 21, 9, 0, 0, Math.PI * 2); ctx.fill();
  var bodyColor = player.heroId === "huang" ? "#d98b2c" : player.heroId === "zhuge" ? "#588bd0" : "#2e914a";
  var capeColor = player.heroId === "huang" ? "#a55a27" : player.heroId === "zhuge" ? "#e7efff" : "#276d3b";
  rig.drawCape(ctx, 0, 7, 24, 18, -Math.PI / 2 + pose.cape, capeColor, "#fff4c8");
  rig.drawBone(ctx, -6, 8, 8, 7, Math.PI / 2 + pose.leftLeg, -pose.leftLeg * 0.35, 6, "#513b2e", "#fff4c8");
  rig.drawBone(ctx, 6, 8, 8, 7, Math.PI / 2 + pose.rightLeg, -pose.rightLeg * 0.35, 6, "#513b2e", "#fff4c8");
  rig.drawBone(ctx, -10, -3, 10, 8, Math.PI / 2 + pose.rearArm, -0.3, 6, bodyColor, "#fff4c8");
  ctx.fillStyle = bodyColor; roundedRect(ctx, -13, -11, 27, 28, 10); ctx.fill();
  ctx.strokeStyle = "#fff4c8"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = "#ffd3a1"; ctx.beginPath(); ctx.arc(-2, -9, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff4c8"; ctx.stroke();
  ctx.fillStyle = bodyColor;
  if (player.heroId === "zhuge") {
    ctx.beginPath(); ctx.moveTo(-17, -16); ctx.lineTo(11, -20); ctx.lineTo(4, -11); ctx.lineTo(-12, -9); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(-4, -18, 10, Math.PI, Math.PI * 2); ctx.fill();
  }
  if (player.heroId === "guan") {
    ctx.fillStyle = "#3d2f26"; roundedRect(ctx, -11, -4, 18, 18, 8); ctx.fill();
  }
  ctx.fillStyle = "#563b2b"; ctx.beginPath(); ctx.arc(-6, -10, 1.6, 0, Math.PI * 2); ctx.arc(2, -10, 1.6, 0, Math.PI * 2); ctx.fill();
  var playerHand = rig.drawBone(ctx, 10, -3, 10, 9, Math.PI / 2 + pose.frontArm, 0.3, 6, bodyColor, "#fff4c8");
  if (player.heroId === "huang") {
    ctx.save(); ctx.translate(playerHand.handX, playerHand.handY); ctx.rotate(aimAngle + pose.weaponAngle);
    ctx.strokeStyle = "#6b4725"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 15, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-pose.action * 9, 0); ctx.lineTo(0, 15); ctx.stroke(); ctx.restore();
  } else if (player.heroId === "zhuge") {
    ctx.save(); ctx.translate(playerHand.handX, playerHand.handY); ctx.rotate(aimAngle + pose.weaponAngle); ctx.scale(1 + pose.action * 0.22, 1 + pose.action * 0.22);
    ctx.fillStyle = "#fff4ce"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(25, -10); ctx.lineTo(24, 11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#6f88ad"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  } else {
    ctx.save(); ctx.translate(playerHand.handX, playerHand.handY); ctx.rotate(aimAngle + pose.weaponAngle);
    ctx.strokeStyle = config.colors.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(28, 0); ctx.stroke();
    ctx.fillStyle = config.colors.gold;
    ctx.beginPath(); ctx.moveTo(39, 0); ctx.quadraticCurveTo(30, -12, 24, -6); ctx.lineTo(28, 0); ctx.lineTo(24, 8); ctx.quadraticCurveTo(31, 13, 39, 0); ctx.fill(); ctx.restore();
  }
  ctx.restore();
};

Renderer.prototype.drawHitEffects = function (effects) {
  var ctx = this.context;
  for (var index = 0; index < effects.length; index += 1) {
    var effect = effects[index];
    var ratio = Math.max(0, effect.life / effect.maxLife);
    ctx.save(); ctx.translate(effect.x, effect.y);
    ctx.globalAlpha = ratio;
    ctx.strokeStyle = effect.kind === "defeat" ? "#fff0a5" : "#ffffff";
    ctx.lineWidth = effect.kind === "defeat" ? 4 : 3;
    var length = effect.kind === "defeat" ? 20 : 11;
    for (var ray = 0; ray < (effect.kind === "defeat" ? 6 : 3); ray += 1) {
      var angle = ray * Math.PI * 2 / (effect.kind === "defeat" ? 6 : 3);
      ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 3); ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length); ctx.stroke();
    }
    if (effect.kind === "hit") {
      ctx.textAlign = "center"; ctx.font = "bold 14px sans-serif"; ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(70,44,26,0.85)"; ctx.strokeText(String(effect.damage), 0, -15 - (1 - ratio) * 9);
      ctx.fillStyle = "#fff4b0"; ctx.fillText(String(effect.damage), 0, -15 - (1 - ratio) * 9);
    }
    ctx.restore();
  }
};

Renderer.prototype.drawSlashes = function (slashes) {
  var ctx = this.context;
  for (var index = 0; index < slashes.length; index += 1) {
    var slash = slashes[index];
    var alpha = Math.min(0.9, slash.maxLife ? slash.life / slash.maxLife : slash.life * 4);
    var color = "239, 201, 86";
    if (slash.color === "fire") { color = "239, 91, 38"; }
    if (slash.color === "whirlwind" || slash.color === "gust" || slash.color === "gustEcho") { color = "83, 197, 184"; }
    if (slash.color === "spell" || slash.color === "spellEcho") { color = "105, 139, 224"; }
    if (slash.color === "thunder") { color = "255, 221, 55"; }
    if (slash.color === "vermillion") { color = "244, 86, 42"; }
    if (slash.color === "trigram") { color = "82, 202, 190"; }
    if (slash.color === "arrowrain" || slash.color === "arrowrainEcho") { color = "225, 145, 45"; }
    if (slash.shape === "lightning") {
      var dx = slash.toX - slash.fromX;
      var dy = slash.toY - slash.fromY;
      var length = Math.sqrt(dx * dx + dy * dy) || 1;
      var normalX = -dy / length;
      var normalY = dx / length;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(slash.fromX, slash.fromY);
      for (var bolt = 1; bolt < 6; bolt += 1) {
        var ratio = bolt / 6;
        var jag = (bolt % 2 === 0 ? -1 : 1) * Math.max(3, 7 - (slash.branch % 3));
        ctx.lineTo(slash.fromX + dx * ratio + normalX * jag, slash.fromY + dy * ratio + normalY * jag);
      }
      ctx.lineTo(slash.toX, slash.toY);
      ctx.shadowColor = "rgba(74, 145, 255, 0.95)";
      ctx.shadowBlur = 2;
      ctx.strokeStyle = "rgba(73, 139, 255, 0.28)";
      ctx.lineWidth = slash.branch === 0 ? 3 : 2.5;
      ctx.stroke();
      ctx.shadowBlur = 1.5;
      ctx.strokeStyle = "rgba(83, 173, 255, 0.95)";
      ctx.lineWidth = slash.branch === 0 ? 1.5 : 1.2;
      ctx.stroke();
      ctx.shadowBlur = 0.5;
      ctx.strokeStyle = "rgba(255, 252, 211, 1)";
      ctx.lineWidth = slash.branch === 0 ? 0.6 : 0.5;
      ctx.stroke();

      ctx.shadowBlur = 2;
      ctx.fillStyle = "rgba(255, 248, 173, 0.96)";
      ctx.beginPath(); ctx.arc(slash.toX, slash.toY, slash.branch === 0 ? 2.2 : 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(126, 207, 255, 0.9)";
      ctx.lineWidth = 0.8;
      for (var spark = 0; spark < 3; spark += 1) {
        var sparkAngle = spark * Math.PI * 2 / 3 + slash.branch * 0.7;
        var inner = slash.branch === 0 ? 3 : 2.5;
        var outer = slash.branch === 0 ? 7 : 6;
        ctx.beginPath();
        ctx.moveTo(slash.toX + Math.cos(sparkAngle) * inner, slash.toY + Math.sin(sparkAngle) * inner);
        ctx.lineTo(slash.toX + Math.cos(sparkAngle) * outer, slash.toY + Math.sin(sparkAngle) * outer);
        ctx.stroke();
      }
      ctx.restore();
      continue;
    }
    ctx.save(); ctx.translate(slash.x, slash.y);
    if (slash.facingX !== undefined) { ctx.rotate(Math.atan2(slash.facingY, slash.facingX)); }
    if (slash.shape === "trigram") {
      var trigramProgress = 1 - Math.max(0, slash.life / slash.maxLife);
      var deployScale = Math.min(1, trigramProgress / 0.14);
      var phase = trigramProgress * 0.72;
      var formationAlpha = trigramProgress < 0.1 ? trigramProgress / 0.1 : trigramProgress > 0.8 ? (1 - trigramProgress) / 0.2 : 1;
      ctx.scale(deployScale, deployScale);
      ctx.globalAlpha = Math.min(0.92, formationAlpha);
      ctx.shadowColor = "rgba(229, 190, 78, 0.7)";
      ctx.shadowBlur = 5;
      ctx.lineJoin = "round";
      ctx.fillStyle = "rgba(22, 58, 58, 0.13)";
      ctx.strokeStyle = "rgba(255, 224, 122, 0.96)";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      for (var corner = 0; corner < 8; corner += 1) {
        var cornerAngle = -Math.PI / 8 + corner * Math.PI / 4;
        var cornerX = Math.cos(cornerAngle) * slash.range;
        var cornerY = Math.sin(cornerAngle) * slash.range;
        if (corner === 0) { ctx.moveTo(cornerX, cornerY); } else { ctx.lineTo(cornerX, cornerY); }
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();

      ctx.save();
      ctx.rotate(phase);
      ctx.shadowBlur = 2;
      for (var trigram = 0; trigram < 8; trigram += 1) {
        ctx.save(); ctx.rotate(trigram * Math.PI / 4);
        ctx.strokeStyle = "rgba(92, 222, 202, 0.72)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(slash.range * 0.3, 0); ctx.lineTo(slash.range * 0.58, 0); ctx.stroke();
        ctx.translate(slash.range * 0.73, 0);
        ctx.fillStyle = "rgba(21, 63, 61, 0.76)";
        ctx.fillRect(-8, -14, 16, 28);
        ctx.strokeStyle = "rgba(255, 230, 136, 0.98)";
        ctx.lineWidth = 2.4;
        for (var bar = 0; bar < 3; bar += 1) {
          var barX = -5 + bar * 5;
          var broken = ((trigram + bar) % 3) === 0;
          ctx.beginPath();
          if (broken) {
            ctx.moveTo(barX, -10); ctx.lineTo(barX, -3);
            ctx.moveTo(barX, 3); ctx.lineTo(barX, 10);
          } else {
            ctx.moveTo(barX, -10); ctx.lineTo(barX, 10);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();

      ctx.save();
      ctx.rotate(-phase * 1.55);
      ctx.strokeStyle = "rgba(89, 225, 206, 0.9)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (var innerCorner = 0; innerCorner < 8; innerCorner += 1) {
        var innerAngle = innerCorner * Math.PI / 4;
        var innerX = Math.cos(innerAngle) * slash.range * 0.48;
        var innerY = Math.sin(innerAngle) * slash.range * 0.48;
        if (innerCorner === 0) { ctx.moveTo(innerX, innerY); } else { ctx.lineTo(innerX, innerY); }
      }
      ctx.closePath(); ctx.stroke();
      for (var spirit = 0; spirit < 8; spirit += 1) {
        ctx.save(); ctx.rotate(spirit * Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(slash.range * 0.19, -3);
        ctx.lineTo(slash.range * 0.42, 0);
        ctx.lineTo(slash.range * 0.19, 3);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      ctx.save();
      ctx.rotate(-phase * 0.72);
      ctx.shadowColor = "rgba(255, 224, 112, 0.72)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = "rgba(244, 241, 193, 0.96)";
      ctx.beginPath(); ctx.arc(0, 0, slash.range * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(25, 70, 68, 0.98)";
      ctx.beginPath(); ctx.arc(0, 0, slash.range * 0.25, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, -slash.range * 0.25); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -slash.range * 0.125, slash.range * 0.055, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(244, 241, 193, 0.96)";
      ctx.beginPath(); ctx.arc(0, slash.range * 0.125, slash.range * 0.055, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.globalAlpha = formationAlpha * Math.max(0.25, 1 - trigramProgress * 0.55);
      ctx.strokeStyle = "rgba(255, 228, 136, 0.78)";
      ctx.lineWidth = 2.2;
      for (var ray = 0; ray < 8; ray += 1) {
        var rayAngle = ray * Math.PI / 4 + phase * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rayAngle) * slash.range * 0.9, Math.sin(rayAngle) * slash.range * 0.9);
        ctx.lineTo(Math.cos(rayAngle) * slash.range * (1.02 + trigramProgress * 0.18), Math.sin(rayAngle) * slash.range * (1.02 + trigramProgress * 0.18));
        ctx.stroke();
      }
      ctx.restore();
      continue;
    }
    if (slash.shape === "sector") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(" + color + ",0.34)";
      ctx.strokeStyle = "rgba(255, 205, 74,0.95)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, slash.range, -slash.halfAngle, slash.halfAngle);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(255, 244, 174,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, slash.range * 0.7, -slash.halfAngle * 0.88, slash.halfAngle * 0.88); ctx.stroke();
      for (var flame = -2; flame <= 2; flame += 1) {
        var flameAngle = flame * slash.halfAngle * 0.36;
        ctx.save(); ctx.rotate(flameAngle);
        ctx.strokeStyle = flame % 2 === 0 ? "rgba(255,244,155,0.9)" : "rgba(255,130,42,0.9)";
        ctx.lineWidth = flame === 0 ? 7 : 4;
        ctx.beginPath();
        ctx.moveTo(slash.range * 0.18, 0);
        ctx.quadraticCurveTo(slash.range * 0.56, flame * 3, slash.range * (0.86 - Math.abs(flame) * 0.05), 0);
        ctx.stroke(); ctx.restore();
      }
      ctx.restore();
      continue;
    }
    if (slash.shape === "gust" || slash.color === "gust" || slash.color === "gustEcho") {
      var gustProgress = slash.maxLife ? 1 - Math.max(0, slash.life / slash.maxLife) : 0;
      var gustEase = 1 - Math.pow(1 - gustProgress, 2);
      var gustRadius = slash.range * gustEase;
      var gustVisibility = gustProgress < 0.08 ? gustProgress / 0.08 : gustProgress > 0.78 ? (1 - gustProgress) / 0.22 : 1;
      ctx.globalAlpha = Math.min(0.9, gustVisibility);
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "rgba(62, 214, 187, 0.62)";
      ctx.shadowBlur = 3;
      ctx.save(); ctx.rotate(gustProgress * 0.55);
      for (var ribbon = 0; ribbon < 12; ribbon += 1) {
        ctx.save(); ctx.rotate(ribbon * Math.PI / 6);
        ctx.strokeStyle = ribbon % 3 === 0 ? "rgba(255, 225, 128, 0.82)" : "rgba(79, 218, 188, 0.86)";
        ctx.lineWidth = ribbon % 3 === 0 ? 2.2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(gustRadius * 0.12, ribbon % 2 === 0 ? -2 : 2);
        ctx.quadraticCurveTo(gustRadius * 0.56, -10 - ribbon % 3 * 3, gustRadius * 0.94, 0);
        ctx.stroke();
        ctx.fillStyle = ribbon % 3 === 0 ? "rgba(255, 225, 128, 0.86)" : "rgba(94, 224, 193, 0.82)";
        ctx.beginPath();
        ctx.moveTo(gustRadius * 0.9, 0);
        ctx.lineTo(gustRadius * 0.82, -4);
        ctx.lineTo(gustRadius * 0.84, 4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      ctx.globalAlpha = gustVisibility * 0.72;
      ctx.fillStyle = "rgba(226, 244, 174, 0.82)";
      for (var moteIndex = 0; moteIndex < 10; moteIndex += 1) {
        var moteAngle = moteIndex * Math.PI * 2 / 10 - gustProgress * 0.8;
        var moteRadius = gustRadius * (0.7 + (moteIndex % 3) * 0.1);
        ctx.beginPath();
        ctx.arc(Math.cos(moteAngle) * moteRadius, Math.sin(moteAngle) * moteRadius, 1.4 + moteIndex % 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      continue;
    }
    ctx.strokeStyle = "rgba(" + color + "," + alpha + ")";
    ctx.lineWidth = slash.color === "echo" ? 3 : 7;
    ctx.beginPath();
    if (slash.full) {
      ctx.arc(0, 0, slash.range, 0, Math.PI * 2);
    } else {
      ctx.arc(0, 0, slash.range, -Math.PI * 0.42, Math.PI * 0.42);
    }
    ctx.stroke(); ctx.restore();
  }
};

Renderer.prototype.drawHud = function (world) {
  var ctx = this.context;
  var top = this.safeTop;
  ctx.fillStyle = "#fff3bd"; ctx.fillRect(0, 0, this.width, this.playTop);
  ctx.fillStyle = config.colors.ink; ctx.textAlign = "left"; ctx.font = "bold 15px sans-serif";
  ctx.fillText(world.hero.name + " · " + world.level + "级" + (world.level >= config.maxBattleLevel ? "·满" : ""), 14, top + 19);
  ctx.font = "14px sans-serif"; ctx.fillText("斩 " + world.kills, 14, top + 42);
  ctx.textAlign = "right"; ctx.font = "bold 15px sans-serif";
  ctx.fillText(world.getWaveLabel(), this.width - 14, top + 19);
  ctx.font = "14px sans-serif"; ctx.fillText(Math.max(0, Math.ceil(world.player.health)) + " / " + world.player.maxHealth, this.width - 14, top + 42);
  var barX = 14; var barWidth = this.width - 28;
  ctx.fillStyle = "rgba(75,53,31,0.16)"; ctx.fillRect(barX, top + 48, barWidth, 7);
  var experienceRatio = world.level >= config.maxBattleLevel ? 1 : world.experience / world.experienceNeeded;
  ctx.fillStyle = config.colors.experience; ctx.fillRect(barX, top + 48, barWidth * experienceRatio, 7);
  ctx.fillStyle = config.colors.danger; ctx.fillRect(barX, top + 58, barWidth * Math.max(0, world.player.health / world.player.maxHealth), 4);
  if (world.feedbackTime > 0) {
    ctx.textAlign = "center"; ctx.font = "bold 21px sans-serif"; ctx.lineWidth = 4;
    ctx.strokeStyle = config.colors.paper; ctx.strokeText(world.feedback, this.width / 2, this.playTop + 34);
    ctx.fillStyle = config.colors.ink; ctx.fillText(world.feedback, this.width / 2, this.playTop + 34);
  }
};

Renderer.prototype.drawJoystick = function (joystick) {
  if (!joystick) { return; }
  var ctx = this.context;
  ctx.fillStyle = "rgba(255,248,232,0.16)"; ctx.strokeStyle = "rgba(41,35,27,0.28)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(joystick.origin.x, joystick.origin.y, joystick.maxRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(41,35,27,0.48)"; ctx.beginPath(); ctx.arc(joystick.knob.x, joystick.knob.y, 17, 0, Math.PI * 2); ctx.fill();
};

Renderer.prototype.getChoiceLayout = function (count) {
  var cardWidth = this.width - 38;
  var cardHeight = Math.min(126, (this.height - this.playTop - 126) / Math.max(1, count));
  var gap = 12;
  var total = count * cardHeight + (count - 1) * gap;
  var startY = this.playTop + Math.max(92, (this.height - this.playTop - total) / 2 + 22);
  return { x: 19, y: startY, width: cardWidth, height: cardHeight, gap: gap };
};

Renderer.prototype.getOfferIndexAt = function (x, y, count) {
  var layout = this.getChoiceLayout(count);
  if (x < layout.x || x > layout.x + layout.width) { return -1; }
  for (var index = 0; index < count; index += 1) {
    var top = layout.y + index * (layout.height + layout.gap);
    if (y >= top && y <= top + layout.height) { return index; }
  }
  return -1;
};

Renderer.prototype.drawChoices = function (world) {
  var ctx = this.context;
  ctx.fillStyle = "rgba(62,52,34,0.72)"; ctx.fillRect(0, this.playTop, this.width, this.height - this.playTop);
  ctx.textAlign = "center"; ctx.fillStyle = config.colors.paper; ctx.font = "bold 24px sans-serif";
  ctx.fillText("阵中领悟", this.width / 2, this.playTop + 50);
  ctx.font = "13px sans-serif"; ctx.fillText("选择一项，战斗将继续", this.width / 2, this.playTop + 74);
  var layout = this.getChoiceLayout(world.offers.length);
  for (var index = 0; index < world.offers.length; index += 1) {
    var offer = world.offers[index];
    var y = layout.y + index * (layout.height + layout.gap);
    roundedRect(ctx, layout.x, y, layout.width, layout.height, 18);
    ctx.fillStyle = "rgba(255,248,219,0.98)"; ctx.fill();
    ctx.strokeStyle = offer.rank === 3 ? config.colors.gold : config.colors.shu; ctx.lineWidth = offer.rank === 3 ? 5 : 3; ctx.stroke();
    ctx.textAlign = "left"; ctx.fillStyle = config.colors.ink; ctx.font = "bold 19px sans-serif";
    ctx.fillText(offer.name + " · " + offer.rank + "级", layout.x + 16, y + 31);
    ctx.fillStyle = config.colors.shu; ctx.font = "bold 12px sans-serif"; ctx.fillText(offer.kind, layout.x + 16, y + 53);
    ctx.fillStyle = config.colors.ink; ctx.font = "14px sans-serif"; ctx.fillText(offer.description, layout.x + 16, y + 79);
    if (offer.rank === 3) {
      ctx.textAlign = "right"; ctx.fillStyle = config.colors.gold; ctx.font = "bold 12px sans-serif";
      ctx.fillText("质变", layout.x + layout.width - 15, y + 31);
    }
  }
};

Renderer.prototype.drawOverlay = function (world) {
  var ctx = this.context;
  ctx.fillStyle = "rgba(32,27,22,0.82)"; ctx.fillRect(0, this.playTop, this.width, this.height - this.playTop);
  ctx.textAlign = "center"; ctx.fillStyle = config.colors.paper; ctx.font = "bold 30px sans-serif";
  var title = "报，蜀军来劫粮";
  if (world.state === "won") { title = "阵斩敌将"; }
  if (world.state === "lost") { title = "孤军力竭"; }
  ctx.fillText(title, this.width / 2, this.height * 0.35);
  ctx.font = "16px sans-serif";
  if (world.state === "intro") {
    ctx.fillText("关羽灰盒 · 两分钟构筑", this.width / 2, this.height * 0.35 + 38);
    ctx.fillText("拖动走位，攻击全自动", this.width / 2, this.height * 0.35 + 65);
  } else {
    ctx.fillText("战斗等级 " + world.level + " · 阵斩 " + world.kills, this.width / 2, this.height * 0.35 + 42);
  }
  ctx.fillStyle = config.colors.gold; ctx.font = "bold 18px sans-serif";
  ctx.fillText(world.state === "intro" ? "按住并拖动开始" : "轻触返回营地", this.width / 2, this.height * 0.35 + 108);
};

module.exports = Renderer;
