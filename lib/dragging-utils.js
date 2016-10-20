// This code is used to implement dragging across all three platforms. Right
// now, -moz-window-dragging: drag is intended to replace WindowDraggingUtils.jsm
// on mac and windows platforms (but not linux/BSD systems). We want a single,
// simple solution that enables dragging on all platforms, while also avoiding
// reinventing the wheel. There also is a problem with -moz-window-dragging on
// windows OS with a chromeless window (like the window used by minvid).
//
// The WindowDraggingElement exported by WindowDraggingUtils.jsm has two checks
// in the constructor that we need to dodge: a test that the platform isn't win
// or mac, and a test that the element made draggable is a panel.

/* global WindowDraggingElement */

const { Cu, Ci } = require('chrome');

// WindowDraggingUtils exports WindowDraggingElement.
Cu.import('resource://gre/modules/WindowDraggingUtils.jsm');

// How to use: search for WindowDraggingElement in dxr :-)

// Makes an element draggable, like WindowDraggingElement, but without the
// "platform must not be win or mac" and "elem must be a panel" checks from the
// WindowDraggingElement constructor.
function DraggableElement(elem) {
  this._elem = elem;
  this._window = elem instanceof Ci.nsIDOMChromeWindow ? elem : elem.ownerDocument.defaultView;
  this._elem.addEventListener('mousedown', this, false);
}
// Take all the rest of the functionality of WindowDraggingElement.
DraggableElement.prototype = WindowDraggingElement.prototype;

// shouldDrag doesn't support starting a window drag from inside an iframe.
// Strip it down to its bare essentials.
// TODO: won't this make it impossible to use the slider? Answer: the slider
// just needs to mark the mouse events as handled.
DraggableElement.prototype.shouldDrag = function(aEvent) {
    // We should drag if it's a left mouse button, we are not full screen,
    // the mouseDownCheck returned truthy, and the event hasn't been
    // prevented.
    return aEvent.button === 0 &&
        !this._window.fullScreen &&
        this.mouseDownCheck.call(this._elem, aEvent) &&
        !aEvent.defaultPrevented;
};

module.exports = DraggableElement;
