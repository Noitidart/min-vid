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

// Load ctypes libraries.
Cu.import('chrome://minvid-ostypes/content/cutils.jsm');
Cu.import('chrome://minvid-ostypes/content/ctypes_math.jsm');

// Figure out what OS we are on.
const platform = Services.appinfo.OS.toLowerCase();

// Platforms we support. gtk includes linux and BSDs.
const platforms = {
  winnt:  'chrome://minvid-ostypes/content/ostypes_win.jsm',
  gtk:    'chrome://minvid-ostypes/content/ostypes_x11.jsm',
  darwin: 'chrome://minvid-ostypes/content/ostypes_mac.jsm'
};

let unsupportedPlatform;

// Load platform-specific code or bail.
if (platform in platforms) Cu.import(platforms[platform]);
else {
  unsupportedPlatform = true;
  console.error(`Operating system ${platform} not recognized. Unable to make minvid window topmost.`);
}

// topify makes the minvid window topmost.
function topify(domWindow) {
  if (unsupportedPlatform) return console.error(`Operating system ${platform} not recognized. Unable to make minvid window topmost.`);
  let didTopify;
  // 1. get 'win', a native pointer for domWindow. this works cross-platform.
  const win = _getNativeHandlePtrStr(domWindow);
  if (!win) return console.error('Unable to get native pointer for window. Topify giving up');

  if (platform === 'winnt') {
    // 2. attempt to set the window to be topmost:
    didTopify = ostypes.API('SetWindowPos')(win, ostypes.CONST.HWND_TOPMOST, 0, 0, 0, 0, ostypes.CONST.SWP_NOSIZE | ostypes.CONST.SWP_NOMOVE);
    // 3. check if it worked. return true if yes, falsy if not
    return didTopify ? true : console.error(`Unable to topify minvid window: ${ctypes.winLastError}`);
  } else if (platform === 'darwin') {
    // 2. attempt to make the window topmost:
    // - figure out what the level is for a 'floating' window
    const floatingWindowLevel = ostypes.API('CGWindowLevelForKey')(ostypes.CONST.kCGFloatingWindowLevelKey);

    // - actually topify
    // TODO: do I need to do coerce the type of floatingWindowLevel? Topick does:
    //   floatingWindowLevel = parseInt(cutils.jscGetDeepest(floatingWindowLevel)
    // but topick also console.logs it and does mathematical comparisons between
    // the top number and the window's current number.

    // get pointer from window string
    const winPtr = ostypes.TYPE.NSWindow(ctypes.UInt64(win));
    didTopify = ostypes.API('objc_msgSend')(winPtr, ostypes.HELPER.sel('setLevel:'), ostypes.TYPE.NSInteger(floatingWindowLevel));

    // 3. check if it worked. return true if yes, falsy if not
    return didTopify ? true : console.error(`Unable to topify minvid window: ${ctypes.winLastError}`);
  } else if (platform === 'gtk') {
    // TODO: we might need to further transform win before attempting to do this.
    // see https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Finding_Window_Handles#Unix

    // 2. topify:
    let ev = ostypes.TYPE.xcb_client_message_event_t();
    ev.response_type = ostypes.CONST.XCB_CLIENT_MESSAGE;
    ev.window = win;
    ev.format = 32;
    ev.data.data32[1] = ostypes.CONST.XCB_CURRENT_TIME;
    ev.type = ostypes.HELPER.cachedXCBAtom('_NET_WM_STATE');
    ev.data.data32[0] = ostypes.CONST._NET_WM_STATE_ADD;
    // TODO: wtf? why are we overwriting this?
    ev.data.data32[1] = ostypes.HELPER.cachedXCBAtom('_NET_WM_STATE_ABOVE');
    const didSend = ostypes.API('xcb_send_event')(ostypes.HELPER.cachedXCBConn(), 0, ostypes.HELPER.cachedXCBRootWindow(),
                                ostypes.CONST.XCB_EVENT_MASK_SUBSTRUCTURE_REDIRECT | ostypes.CONST.XCB_EVENT_MASK_SUBSTRUCTURE_NOTIFY,
                                ctypes.cast(ev.address(), ctypes.char.ptr));
    const didFlush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
    // TODO: what do we return here? which one should be assigned to didTopify?
    return !!didSend;
  } else return console.error('Error: cannot topify minvid window on an unsupported operating system.');
}





// function that returns a string pointer to a native window.
// For example, "0x1cada0400".
function _getNativeHandlePtrStr(domWindow) {
  const baseWindow = domWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIWebNavigation)
                      .QueryInterface(Ci.nsIDocShellTreeItem)
                      .treeOwner
                      .QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIBaseWindow);
  return baseWindow.nativeHandle;
}

module.exports = topify;
