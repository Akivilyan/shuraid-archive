"use strict";

function ChoiceInputGuard(delayMs) {
  this.delayMs = delayMs === undefined ? 240 : delayMs;
  this.openedAt = 0;
  this.pendingIndex = -1;
}

ChoiceInputGuard.prototype.open = function (now) {
  this.openedAt = now;
  this.pendingIndex = -1;
};

ChoiceInputGuard.prototype.press = function (index, now) {
  this.pendingIndex = -1;
  if (index < 0 || now - this.openedAt < this.delayMs) { return false; }
  this.pendingIndex = index;
  return true;
};

ChoiceInputGuard.prototype.release = function (index) {
  var accepted = this.pendingIndex >= 0 && index === this.pendingIndex;
  this.pendingIndex = -1;
  return accepted;
};

ChoiceInputGuard.prototype.cancel = function () {
  this.pendingIndex = -1;
};

module.exports = ChoiceInputGuard;
