"use strict";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function frameIndex(progress, count) {
  return Math.max(0, Math.min(count - 1, Math.floor(progress * count)));
}

function loopFrame(time, framesPerSecond, count) {
  return Math.floor(time * framesPerSecond) % count;
}

function playerPose(player, elapsed) {
  var state = "idle";
  var frame = loopFrame(elapsed, 3, 4);
  if ((player.hurtTime || 0) > 0) {
    state = "hurt";
    frame = 0;
  } else if (player.actionTime > 0) {
    state = "attack";
    var actionDuration = player.heroId === "zhuge" ? 0.32 : 0.18;
    frame = frameIndex(1 - clamp01(player.actionTime / actionDuration), 4);
  } else if (player.moving) {
    state = "move";
    frame = loopFrame(player.walkTime, 10, 4);
  }

  var moveStride = [0.48, 0, -0.48, 0];
  var moveBob = [0, -1.8, 0, -1.8];
  var idleBob = [0, -0.35, -0.7, -0.35];
  var stride = state === "move" ? moveStride[frame] : 0;
  var actionFrames = [0.18, 0.62, 1, 0.32];
  var action = state === "attack" ? actionFrames[frame] : 0;
  var hurt = state === "hurt" ? 1 : 0;
  var pose = {
    state: state,
    frame: frame,
    walk: stride,
    action: action,
    hurt: hurt,
    bob: state === "move" ? moveBob[frame] : state === "idle" ? idleBob[frame] : 0,
    bodyTilt: hurt > 0 ? -0.12 : 0,
    bodyScaleX: 1 + hurt * 0.1,
    bodyScaleY: 1 - hurt * 0.12,
    leftLeg: stride,
    rightLeg: -stride,
    rearArm: -stride * 0.42,
    frontArm: stride * 0.42,
    cape: state === "move" ? [-0.08, 0.04, 0.08, -0.04][frame] : state === "idle" ? [-0.03, 0, 0.03, 0][frame] : -action * 0.08,
    weapon: action
  };
  if (player.heroId === "guan") {
    if (state === "attack") {
      pose.frontArm = [-0.35, -0.65, -0.15, 0.08][frame];
      pose.rearArm = [0.18, -0.18, -0.45, -0.08][frame];
    }
    pose.weaponAngle = state === "attack" ? [-0.85, -0.45, 0.72, 0.18][frame] : -0.12;
  } else if (player.heroId === "huang") {
    if (state === "attack") {
      pose.frontArm = [-0.15, -0.3, -0.38, -0.08][frame];
      pose.rearArm = [0.12, 0.35, 0.52, 0.08][frame];
    }
    pose.weaponAngle = 0;
  } else {
    if (state === "attack") {
      pose.frontArm = [-0.1, -0.42, -0.62, -0.16][frame];
      pose.rearArm = [0.08, 0.22, 0.12, 0.04][frame];
    }
    pose.weaponAngle = state === "attack" ? [-0.18, -0.05, 0.2, 0.05][frame] : 0;
  }
  return pose;
}

function enemyPose(enemy) {
  var frequency = enemy.type === "runner" ? 13 : enemy.type === "brute" ? 6.5 : 8.5;
  var state = enemy.hitFlash > 0 ? "hurt" : enemy.attackTime > 0 ? "attack" : "move";
  var frame = state === "move" ? loopFrame(enemy.age, frequency / 2.5, 4) : state === "attack" ? frameIndex(1 - clamp01(enemy.attackTime / 0.24), 4) : 0;
  var stride = state === "move" ? [0.38, 0, -0.38, 0][frame] : 0;
  var attack = state === "attack" ? [0.2, 0.65, 1, 0.3][frame] : 0;
  var hurt = state === "hurt" ? 1 : 0;
  return {
    state: state,
    frame: frame,
    walk: stride,
    attack: attack,
    hurt: hurt,
    bob: state === "move" ? [0, -0.8, 0, -0.8][frame] : 0,
    bodyTilt: hurt > 0 ? -0.1 : 0,
    leftLeg: stride,
    rightLeg: -stride,
    rearArm: -stride * 0.35,
    frontArm: stride * 0.35 - attack * 0.55,
    weaponAngle: -attack * 0.22
  };
}

function bonePoints(x, y, upperLength, lowerLength, upperAngle, bendAngle) {
  var elbowX = x + Math.cos(upperAngle) * upperLength;
  var elbowY = y + Math.sin(upperAngle) * upperLength;
  var lowerAngle = upperAngle + bendAngle;
  return {
    elbowX: elbowX,
    elbowY: elbowY,
    handX: elbowX + Math.cos(lowerAngle) * lowerLength,
    handY: elbowY + Math.sin(lowerAngle) * lowerLength,
    angle: lowerAngle
  };
}

function drawBone(ctx, x, y, upperLength, lowerLength, upperAngle, bendAngle, width, color, outline) {
  var points = bonePoints(x, y, upperLength, lowerLength, upperAngle, bendAngle);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = outline;
  ctx.lineWidth = width + 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(points.elbowX, points.elbowY); ctx.lineTo(points.handX, points.handY); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(points.elbowX, points.elbowY); ctx.lineTo(points.handX, points.handY); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(points.handX, points.handY, Math.max(2, width * 0.55), 0, Math.PI * 2); ctx.fill();
  return points;
}

function drawCape(ctx, x, y, length, width, angle, color, trim) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -width * 0.5);
  ctx.quadraticCurveTo(-length * 0.6, -width * 0.7, -length, 0);
  ctx.quadraticCurveTo(-length * 0.6, width * 0.7, 0, width * 0.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

module.exports = {
  playerPose: playerPose,
  enemyPose: enemyPose,
  drawBone: drawBone,
  drawCape: drawCape
};
