"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var TouchController = require("../src/input/touch-controller");
var ChoiceInputGuard = require("../src/input/choice-input-guard");

function makeWxInput() {
  var handlers = {};
  return {
    handlers: handlers,
    onTouchStart: function (handler) { handlers.start = handler; },
    onTouchMove: function (handler) { handlers.move = handler; },
    onTouchEnd: function (handler) { handlers.end = handler; },
    onTouchCancel: function (handler) { handlers.cancel = handler; }
  };
}

test("skill choice requires a fresh press and release on the same card", function () {
  var guard = new ChoiceInputGuard(240);
  guard.open(1000);
  assert.equal(guard.press(1, 1100), false);
  assert.equal(guard.release(1), false);
  assert.equal(guard.press(1, 1240), true);
  assert.equal(guard.release(2), false);
  assert.equal(guard.press(1, 1300), true);
  assert.equal(guard.release(1), true);
  assert.equal(guard.release(1), false);
});

test("touch release is reported even when a modal press does not start the joystick", function () {
  var wxInput = makeWxInput();
  var releases = [];
  var controller = new TouchController(wxInput, function () { return false; }, function (x, y, cancelled) {
    releases.push({ x: x, y: y, cancelled: cancelled });
  });
  wxInput.handlers.start({ touches: [{ clientX: 40, clientY: 80 }] });
  wxInput.handlers.move({ touches: [{ clientX: 44, clientY: 86 }] });
  assert.equal(controller.active, false);
  wxInput.handlers.end({ changedTouches: [{ clientX: 44, clientY: 86 }] });
  assert.deepEqual(releases, [{ x: 44, y: 86, cancelled: false }]);
});

test("cancelled touches can never confirm a pending skill choice", function () {
  var guard = new ChoiceInputGuard(0);
  guard.open(1000);
  assert.equal(guard.press(0, 1000), true);
  guard.cancel();
  assert.equal(guard.release(0), false);
});
