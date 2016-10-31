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

/* global WindowDraggingElement, AppConstants */

const { Cu, Ci } = require('chrome');

const utils = require('./native-window-utils.js');

Cu.import('resource://gre/modules/AppConstants.jsm');
// WindowDraggingUtils exports WindowDraggingElement.
Cu.import('resource://gre/modules/WindowDraggingUtils.jsm');

// Imports needed for cutils stuff
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import('chrome://minvid-ostypes/content/cutils.jsm');


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
    // TODO: add a check that the element doesn't have an ancestor
    // with the 'nodrag' class. This should fix the slider issue.
    return aEvent.button === 0 &&
        !this._window.fullScreen &&
        this.mouseDownCheck.call(this._elem, aEvent) &&
        !aEvent.defaultPrevented;
};

// need to override handleEvent in the case of mousedown on linux.
// on linux, the WindowDraggingUtils.jsm code calls window.beginWindowMove, but
// that API isn't found on the minvid window for some weird reason.
DraggableElement.prototype._handleEvent = DraggableElement.prototype.handleEvent;
DraggableElement.prototype.handleEvent = function(aEvent) {
  if (aEvent.type === 'mousedown' && /^gtk/i.test(AppConstants.MOZ_WIDGET_TOOLKIT)) {
    // handle the event ourselves by calling beginWindowMove(aEvent, null);
    //
    // just do what beginWindowMove does (nsGlobalWindow.cpp):
    // I think we somehow need to get from a mouse event to a
    // WidgetMouseEvent, that we can pass to gdk_window_begin_move_drag
    //
    // But wait! We don't need a mouse event. We just need to pass a window pointer.
    // We also should make sure the button's still pressed. And we need to know which
    // button is initiating the drag.
    
    // 1. get the window.gdk_window_begin_move_drag.
    // TODO: note that mvWindow, the window we care about, is passed into the
    // constructor and stored as this._window.
    const winPtrStr = utils.getNativeHandlePtrStr(this._window);
    const gdkWin = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(winPtrStr));
    // 2. TODO: make sure the button is pressed. (see beginWindowMove or check in JS)
    // 3. get the mouse coords from the event
    const button = 1; // TODO: get this from the event
    // TODO: make sure the button is still pressed down. seems (based on the Gecko
    // code) like this might throw if not.
    const coords = utils.getMouseCoords();

    // TODO: if this doesn't work, use the current time instead of the mouse event time.
    let timestamp = ostypes.TYPE.gint(ctypes.UInt32(aEvent.timestamp));
    // 3. call the method
    ostypes.API('gdk_window_begin_move_drag')(gdkWin, button, coords.x, coords.y, timestamp);
  }
  else this._handleEvent(aEvent);

  // in general, we don't want the mousedown passed through to the iframe
  return true;
};

module.exports = DraggableElement;
