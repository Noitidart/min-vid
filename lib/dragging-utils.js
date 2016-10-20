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
// We also have to hack around an iframe check inside shouldDrag.
// Copied that function over with the bug 615152 fix removed:
DraggableElement.prototype.shouldDrag = function(aEvent) {
    if (aEvent.button != 0 ||
        this._window.fullScreen ||
        !this.mouseDownCheck.call(this._elem, aEvent) ||
        aEvent.defaultPrevented)
      return false;

    let target = aEvent.originalTarget, parent = aEvent.originalTarget;

/* this is the bit we're excluding.
    // The target may be inside an embedded iframe or browser. (bug 615152)
    if (target.ownerDocument.defaultView != this._window)
      return false;
*/

    while (parent != this._elem) {
      let mousethrough = parent.getAttribute("mousethrough");
      if (mousethrough == "always")
        target = parent.parentNode;
      else if (mousethrough == "never")
        break;
      parent = parent.parentNode;
    }
    while (target != this._elem) {
      if (this.dragTags.indexOf(target.localName) == -1)
        return false;
      target = target.parentNode;
    }
    return true;
};

module.exports = DraggableElement;
