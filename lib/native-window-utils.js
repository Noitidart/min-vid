const { Ci } = require('chrome');

// Given an nsIDOMWindow, return a string pointer to the native window.
function getNativeHandlePtrStr(domWindow) {
  const baseWindow = domWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIWebNavigation)
                      .QueryInterface(Ci.nsIDocShellTreeItem)
                      .treeOwner
                      .QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIBaseWindow);
  return baseWindow.nativeHandle;
};

module.exports = {
  getNativeHandlePtrStr: getNativeHandlePtrStr
};
