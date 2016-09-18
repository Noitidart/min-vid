/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const system = require('sdk/system');
const pageMod = require('sdk/page-mod');
const { getActiveView } = require('sdk/view/core');
const getYouTubeUrl = require('./lib/get-youtube-url.js');
const getVimeoUrl = require('./lib/get-vimeo-url.js');
const launchVideo = require('./lib/launch-video');
const sendMetricsData = require('./lib/send-metrics-data.js');
const initContextMenuHandlers = require('./lib/context-menu-handlers.js');
const makePanelDraggable = require('./lib/make-panel-draggable.js');
const { setTimeout } = require('sdk/timers');

const dimensions = {
  width: 320,
  height: 180,
  minimizedHeight: 40
};

const panel = require('sdk/panel').Panel({
  contentURL: './default.html',
  contentScriptFile: './controls.js',
  width: dimensions.width,
  height: dimensions.height,
  position: {
    bottom: 10,
    left: 10
  }
});

// Init the panel's location state
panel.coords = { bottomOffset: -10, leftOffset: 10 };

getActiveView(panel).setAttribute('noautohide', true);

// Draggability seems to work for windows and mac, but not linux.
if (system.platform === 'winnt' || system.platform === 'darwin') {
  // We have to wait until XBL has initialized before changing the 'type'.
  setTimeout(() => { makePanelDraggable(panel, dimensions); }, 5000);
}

// If the panel's opening tab is closed, prevent it from being destroyed
// by reattaching it to whatever other browser window is available.
function updateDocumentAnchor(evt) {
  console.log('updateDocumentAnchor called. evt is: ', evt);
  // 1. Is the panel's parent window closed? If so, we need to find a new home,
  // so find another window; if one's found, cancel the event and move it to
  // the new DOM. If not, there's nothing more we can do.
  // TODO: also check that Firefox isn't shutting down.

  if (getActiveView(panel).ownerGlobal.closed) {
    const newWindow = Services.wm.getMostRecentWindow('navigator:browser');
    if (newWindow.closed) {
      // TODO: iterate some windows to find one that isn't closing.
      console.error('ugh, newWindow is closed too. I give up');
      return;
    }
    console.log('we found a new window! moving the panel there now');
    // We found a new window! Cancel the event and move this party over there.
    evt.stopImmediatePropagation();
    evt.preventDefault();
    const xulPanel = getActiveView(panel);
    xulPanel.parentNode.removeChild(xulPanel);
    const newPopupSet = newWindow.document.getElementById('mainPopupSet');
    newPopupSet.appendChild(xulPanel);
  }
}
const xulPanel = getActiveView(panel)
xulPanel.addEventListener('popuphiding', updateDocumentAnchor);


function adjustHeight(newHeight) {
  // Resize the panel by changing the height of the panel, iframe, and stack
  // elements.
  // On linux, makePanelDraggable isn't invoked, so the stack doesn't exist.
  const xulPanel = getActiveView(panel);
  const stack = xulPanel.getElementsByTagName('stack') && xulPanel.getElementsByTagName('stack')[0];
  const frame = xulPanel.getElementsByTagName('iframe')[0];

  frame.setAttribute('height', newHeight);
  if (stack) stack.setAttribute('height', newHeight);
  xulPanel.sizeTo(dimensions.width, newHeight);

  redrawPanel();
}

function redrawPanel() {
  const xulPanel = getActiveView(panel);

  xulPanel.moveToAnchor(xulPanel.ownerDocument.documentElement, 'bottomleft bottomleft', panel.coords.leftOffset, panel.coords.bottomOffset);
}

panel.port.on('addon-message', opts => {
  const title = opts.action;

  if (title === 'send-to-tab') {
    const pageUrl = getPageUrl(opts.domain, opts.id, opts.time);
    if (pageUrl) require('sdk/tabs').open(pageUrl);
    else {
      console.error('could not parse page url for ', opts); // eslint-disable-line no-console
      panel.port.emit('set-video', {error: 'Error loading video from ' + opts.domain});
    }
    panel.port.emit('set-video', {domain: '', src: ''});
    panel.hide();
  } else if (title === 'close') {
    panel.port.emit('set-video', {domain: '', src: ''});
    panel.hide();
  } else if (title === 'minimize') {
    adjustHeight(dimensions.minimizedHeight);
  } else if (title === 'maximize') {
    adjustHeight(dimensions.height);
  } else if (title === 'metrics-event') {
    sendMetricsData(opts, panel);
  }
});

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

// handle browser resizing
pageMod.PageMod({
  include: '*',
  contentScriptFile: './resize-listener.js',
  onAttach: function(worker) {
    worker.port.on('resized', function() {
      if (panel.isShowing) {
        redrawPanel();
      }
    });
  }
});

// add launch icon to video embeds
pageMod.PageMod({
  include: '*',
  contentStyleFile: './icon-overlay.css',
  contentScriptFile: './icon-overlay.js',
  onAttach: function(worker) {
    worker.port.on('launch', function(opts) {
      if (opts.domain.indexOf('youtube.com') > -1) {
        opts.getUrlFn = getYouTubeUrl;
        sendMetricsData({
          object: 'overlay_icon',
          method: 'launch',
          domain: opts.domain
        }, panel);
        launchVideo(opts, panel);
      } else if (opts.domain.indexOf('vimeo.com')  > -1) {
        opts.getUrlFn = getVimeoUrl;
        sendMetricsData({
          object: 'overlay_icon',
          method: 'launch',
          domain: opts.domain
        }, panel);
        launchVideo(opts, panel);
      }
    });

    worker.port.on('metrics', function(opts) {
      sendMetricsData(opts);
    });
  }
});

// add 'send-to-mini-player' option to context menu
initContextMenuHandlers(panel);
