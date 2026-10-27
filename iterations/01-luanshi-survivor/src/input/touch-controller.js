"use strict";

var math = require("../core/math");

function TouchController(wxApi, onPress, onRelease) {
  this.wxApi = wxApi;
  this.onPress = onPress;
  this.onRelease = onRelease || null;
  this.active = false;
  this.contactActive = false;
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
    self.contactActive = true;
    self.origin = { x: touch.clientX, y: touch.clientY };
    self.current = { x: touch.clientX, y: touch.clientY };
    if (self.onPress(touch.clientX, touch.clientY) === false) {
      self.active = false;
      return;
    }
    self.active = true;
  });
  this.wxApi.onTouchMove(function (event) {
    if (!self.contactActive || event.touches.length === 0) { return; }
    var touch = event.touches[0];
    self.current = { x: touch.clientX, y: touch.clientY };
  });
  this.wxApi.onTouchEnd(function (event) {
    if (!self.contactActive) { return; }
    var touch = event.changedTouches && event.changedTouches[0];
    var x = touch ? touch.clientX : self.current.x;
    var y = touch ? touch.clientY : self.current.y;
    self.active = false;
    self.contactActive = false;
    if (self.onRelease) { self.onRelease(x, y, false); }
  });
  this.wxApi.onTouchCancel(function () {
    self.active = false;
    self.contactActive = false;
    if (self.onRelease) { self.onRelease(self.current.x, self.current.y, true); }
  });
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
