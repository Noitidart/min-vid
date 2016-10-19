/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

// This library uses js-ctypes to force the minvid window to be topmost
// on linux/*BSD, windows, and mac systems.
//
// This library is partially derived from MPL 2.0-licensed code available at
// https://github.com/Noitidart/Topick.

/* global Services */
const { Cu, Ci } = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/ctypes.jsm');

Cu.import('chrome://minvid-ostypes/content/cutils.jsm');
Cu.import('chrome://minvid-ostypes/content/ctypes_math.jsm');

let platform;
let unsupportedPlatform;

function _initPlatformCode() {
  // Platforms we support. gtk includes unix-like systems.
  const platforms = {
    windows:  'chrome://minvid-ostypes/content/ostypes_win.jsm',
    gtk:    'chrome://minvid-ostypes/content/ostypes_x11.jsm',
    cocoa: 'chrome://minvid-ostypes/content/ostypes_mac.jsm'
  };

  let wm = Services.appinfo.widgetToolkit.toLowerCase();
  platform = (wm.indexOf('gtk') === 0) ? 'gtk' : wm;

  if (platform in platforms) Cu.import(platforms[platform]);
  else unsupportedPlatform = true;
}
_initPlatformCode();

// topify tries to make the provided domWindow topmost, using platform-specific code.
// Returns true if successful.
function topify(domWindow) {
  if (unsupportedPlatform) return console.error(`Unable to topify minvid window on unsupported window toolkit ${platform}.`);

  const winPtrStr = _getNativeHandlePtrStr(domWindow);
  if (!winPtrStr) return console.error('Unable to get native pointer for window.');

  if (platform === 'windows')    return _winntTopify(winPtrStr);
  else if (platform === 'cocoa') return _macTopify(winPtrStr);
  else if (platform === 'gtk')   return _nixTopify(winPtrStr);
}

// Given an nsIDOMWindow, return a string pointer to the native window.
function _getNativeHandlePtrStr(domWindow) {
  const baseWindow = domWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIWebNavigation)
                      .QueryInterface(Ci.nsIDocShellTreeItem)
                      .treeOwner
                      .QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIBaseWindow);
  return baseWindow.nativeHandle;
}

function _winntTopify(winPtrStr) {
  const winPtr = ctypes.voidptr_t(ctypes.UInt64(winPtrStr));
  const didTopify = ostypes.API('SetWindowPos')(winPtr, ostypes.CONST.HWND_TOPMOST, 0, 0, 0, 0, ostypes.CONST.SWP_NOSIZE | ostypes.CONST.SWP_NOMOVE);
  return didTopify ? true : console.error(`Unable to topify minvid window: ${ctypes.winLastError}`);
}

function _macTopify(winPtrStr) {
  const floatingWindowLevel = ostypes.API('CGWindowLevelForKey')(ostypes.CONST.kCGFloatingWindowLevelKey);
  const winPtr = ostypes.TYPE.NSWindow(ctypes.UInt64(winPtrStr));
  const didTopify = ostypes.API('objc_msgSend')(winPtr, ostypes.HELPER.sel('setLevel:'), ostypes.TYPE.NSInteger(floatingWindowLevel));
  return didTopify ? true : console.error(`Unable to topify minvid window: ${ctypes.winLastError}`);
}

function _nixTopify(winPtrStr) {
  // TODO: we might need to further transform win before attempting to do this.
  // see https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Finding_Window_Handles#Unix
  let ev = ostypes.TYPE.xcb_client_message_event_t();
  ev.response_type = ostypes.CONST.XCB_CLIENT_MESSAGE;
  ev.window = ostypes.HELPER.gdkWinPtrToXID(ostypes.TYPE.GdkWindow(ctypes.UInt64(winPtrStr)));
  ev.format = 32;
  ev.data.data32[1] = ostypes.CONST.XCB_CURRENT_TIME;
  ev.type = ostypes.HELPER.cachedXCBAtom('_NET_WM_STATE');
  ev.data.data32[0] = ostypes.CONST._NET_WM_STATE_ADD;
  ev.data.data32[1] = ostypes.HELPER.cachedXCBAtom('_NET_WM_STATE_ABOVE');
  const didSend = ostypes.API('xcb_send_event')(ostypes.HELPER.cachedXCBConn(), 0, ostypes.HELPER.cachedXCBRootWindow(),
                              ostypes.CONST.XCB_EVENT_MASK_SUBSTRUCTURE_REDIRECT | ostypes.CONST.XCB_EVENT_MASK_SUBSTRUCTURE_NOTIFY,
                              ctypes.cast(ev.address(), ctypes.char.ptr));
  const didFlush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
  return !!didSend;
}

module.exports = topify;
