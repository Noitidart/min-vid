/* global Services */
const { Cu } = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');

const self = require("sdk/self");
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { setTimeout } = require('sdk/timers');

const messageHandler = require('./message-handler.js');
let mvWindow;
let messageManager;

// waits till the window is ready, then calls callbacks.
function whenReady(cb) {
  // TODO: instead of setting timeout for each callback, just poll, then call all callbacks.
  if (!!messageManager) return cb();
  setTimeout(() => { whenReady(cb) }, 25);
}

function send(eventName, msg) {
  whenReady(() => {
    messageManager.sendAsyncMessage('minvid-msg-from-chrome', { type: eventName, args: msg });
  });
}

function getWindow() {
  return mvWindow;
}

function create() {
  if (mvWindow) return mvWindow;

  const window = getMostRecentBrowserWindow();
  // implicit assignment to mvWindow global
  mvWindow = window.open('chrome://minvid-data/content/default.html', 'minvid',
                         'chrome,dialog=no,width=320,height=180,titlebar=no');
  initCommunication();
  return mvWindow;
}

function initCommunication() {
  // TODO: what if the window's message manager isn't ready yet? do we need to
  // poll until it's ready?

  // iterate over all windows till you find a window with name == 'minvid'
  const windows = Services.wm.getEnumerator('navigator:browser');
  let w;
  while (windows.hasMoreElements()) {
    w = windows.getNext();
    if (w.name === 'minvid') break;
  }

  // implicit assignment to `messageManager` global
  messageManager = w.gBrowser.selectedBrowser.messageManager;

  messageManager.loadFrameScript('chrome://minvid-data/content/frame-script.js', false);
  messageManager.addMessageListener('message', messageHandler);
}

function destroy() {
  if (!mvWindow) return;
  mvWindow.close();
  // TODO: do we need to manually tear down frame scripts?
  mvWindow = null;
}

function updateWindow() {
  return mvWindow || create();
}

function show() {
  if (!mvWindow) create();
}

module.exports = {
  whenReady: whenReady,
  create: create,
  destroy: destroy,
  getWindow: getWindow,
  updateWindow: updateWindow,
  // replaces panel.port.emit
  send: send,
  // replaces panel.show
  show: show
};
