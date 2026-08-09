"use strict";

var math = require("../core/math");

function TouchController(wxApi, onPress) {
  this.wxApi = wxApi;
  this.onPress = onPress;
  this.active = false;
  this.origin = { x: 0, y: 0 };
  this.current = { x: 0, y: 0 };
  this.maxRadius = 52;
  this.bind();
}

TouchController.prototype.bind = function () {
  var self = this;
  this.wxApi.onTouchStart(function (event) {
    var touch = event.touches[0];
    if (!touch) { return; }
    if (self.onPress(touch.clientX, touch.clientY) === false) {
      self.active = false;
      return;
    }
    self.active = true;
    self.origin = { x: touch.clientX, y: touch.clientY };
    self.current = { x: touch.clientX, y: touch.clientY };
  });
  this.wxApi.onTouchMove(function (event) {
    if (!self.active || event.touches.length === 0) { return; }
    var touch = event.touches[0];
    self.current = { x: touch.clientX, y: touch.clientY };
  });
  this.wxApi.onTouchEnd(function () { self.active = false; });
  this.wxApi.onTouchCancel(function () { self.active = false; });
};

TouchController.prototype.getDirection = function () {
  if (!this.active) { return { x: 0, y: 0 }; }
  var direction = math.normalize(this.current.x - this.origin.x, this.current.y - this.origin.y);
  if (direction.length < 6) { return { x: 0, y: 0 }; }
  return { x: direction.x, y: direction.y };
};

TouchController.prototype.getVisualState = function () {
  if (!this.active) { return null; }
  var direction = math.normalize(this.current.x - this.origin.x, this.current.y - this.origin.y);
  var radius = Math.min(direction.length, this.maxRadius);
  return {
    origin: this.origin,
    knob: {
      x: this.origin.x + direction.x * radius,
      y: this.origin.y + direction.y * radius
    },
    maxRadius: this.maxRadius
  };
};

module.exports = TouchController;
