/* global Services */
const { Cu } = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');

const self = require("sdk/self");
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { setTimeout } = require('sdk/timers');

let mvWindow;

// waits till the window is ready, then calls callbacks.
function whenReady(cb) {
  // TODO: instead of setting timeout for each callback, just poll, then call all callbacks.
  if (mvWindow && mvWindow.wrappedJSObject.AppData) return cb();
  setTimeout(() => { whenReady(cb) }, 25);
}

// I can't get frame scripts working, so instead we just set global state directly in react. fml
function send(eventName, msg) {
  whenReady(() => {
    const newData = Object.assign(mvWindow.wrappedJSObject.AppData, msg);
    mvWindow.wrappedJSObject.AppData = newData;
  });
}

function getWindow() {
  return mvWindow;
}

function create() {
  console.log('create window');
  if (mvWindow) return mvWindow;

  const window = getMostRecentBrowserWindow();
  // implicit assignment to mvWindow global
  mvWindow = window.open(self.data.url('default.html'), 'minvid',
                         'chrome,dialog=no,width=320,height=180,titlebar=no');
  initCommunication();
  return mvWindow;
}

function initCommunication() {
  console.log('initCommunication window');
  // When the window's ready, start polling for pending commands
  function pollForCommands() {
    try {
      const cmd = mvWindow.wrappedJSObject.pendingCommand; 
      if (!cmd) return;

      // We found a command! Erase it, then act on it.
      console.log('found a command!', cmd);
      mvWindow.wrappedJSObject.pendingCommand = '';
      const parsed = JSON.parse(cmd);
      handleMessage(parsed); 
    } catch (ex) {
      console.error('pollForCommands hit an error: ', ex);
    } finally {
      setTimeout(pollForCommands, 25);
    }
  }
  whenReady(pollForCommands);
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

function handleMessage(msg) {
  console.log('handleMessage: ', msg);
  const title = msg.type;
  const opts = msg.args;
  if (title === 'send-to-tab') {
    const pageUrl = getPageUrl(opts.domain, opts.id, opts.time);
    if (pageUrl) require('sdk/tabs').open(pageUrl);
    else {
      console.error('could not parse page url for ', opts); // eslint-disable-line no-console
      send('set-video', {error: 'Error loading video from ' + opts.domain});
    }
    send('set-video', {domain: '', src: ''});
    mvWindow.close();
  } else if (title === 'close') {
    send('set-video', {domain: '', src: ''});
    mvWindow.close();
  } else if (title === 'minimize') {
    // TODO: shrink the window
  } else if (title === 'maximize') {
    // TODO: unshrink the window
  } else if (title === 'metrics-event') {
    // Note: sending in the panel ref to try to avoid circular imports.
    // TODO: fix this, it won't work any longer. simplify.
    sendMetricsData(opts.payload, sdkPanel);
  }
}

function getPageUrl(domain, id, time) {
  let url;
  if (domain.indexOf('youtube') > -1) {
    url = `https://youtube.com/watch?v=${id}&t=${Math.floor(time)}`;
  } else if (domain.indexOf('vimeo') > -1) {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time - min * 60);
    url = `https://vimeo.com/${id}#t=${min}m${sec}s`;
  } else if (domain.indexOf('vine') > -1) {
    url = `https://vine.co/v/${id}`;
  }

  return url;
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
