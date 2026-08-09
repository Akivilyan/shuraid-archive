"use strict";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function length(x, y) {
  return Math.sqrt(x * x + y * y);
}

function normalize(x, y) {
  var magnitude = length(x, y);
  if (magnitude < 0.0001) {
    return { x: 0, y: 0, length: 0 };
  }
  return { x: x / magnitude, y: y / magnitude, length: magnitude };
}

function distanceSquared(first, second) {
  var dx = first.x - second.x;
  var dy = first.y - second.y;
  return dx * dx + dy * dy;
}

module.exports = {
  clamp: clamp,
  length: length,
  normalize: normalize,
  distanceSquared: distanceSquared
};
