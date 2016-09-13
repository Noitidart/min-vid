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

const panel = require('sdk/panel').Panel({
  contentURL: './default.html',
  contentScriptFile: './controls.js',
  width: 320,
  height: 180,
  position: {
    bottom: 10,
    left: 10
  }
});

// Init the panel's location state
// XXX note this should be the offset relative to bottom-left corner of browser window.
panel.coords = { bottomOffset: -10, leftOffset: 10 };

getActiveView(panel).setAttribute('noautohide', true);

// Draggability seems to work for windows and mac, but not linux.
if (system.platform === 'winnt' || system.platform === 'darwin') {
  makePanelDraggable(panel);
}

function adjustHeight(newHeight, isMinimize) {
  console.log('adjustHeight');
  const xulPanel = getActiveView(panel);
  const stack = xulPanel.getElementsByTagName('stack')[0];
  const frame = xulPanel.getElementsByTagName('iframe')[0];

  // What if we just resized instead?
  //xulPanel.setAttribute('height', newHeight);
  frame.setAttribute('height', newHeight);
  stack.setAttribute('height', newHeight);
  xulPanel.sizeTo(320, newHeight);

  // travel up the DOM to get a document pointer
  let doc = xulPanel;
  while (doc !== null && doc.nodeType !== 9) {
    doc = doc.parentNode;
  }

  // In the case of minimizing, add 140 to the y-coordinate. moveToAnchor doesn't
  // recalculate when part of the panel is hidden :-\
  xulPanel.moveToAnchor(doc.documentElement, 'bottomleft bottomleft', panel.coords.leftOffset, panel.coords.bottomOffset); 
}

function redrawPanel() {
  const xulPanel = getActiveView(panel);

  // travel up the DOM to get a document pointer
  let doc = xulPanel;
  while (doc !== null && doc.nodeType !== 9) {
    doc = doc.parentNode;
  }

  console.log('redrawPanel, moving to: (x, y) ', panel.coords.leftOffset, panel.coords.bottomOffset);
  xulPanel.moveToAnchor(doc.documentElement, 'bottomleft bottomleft', panel.coords.leftOffset, panel.coords.bottomOffset);
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
    // If the panel has been minimized, reset it to full height.
    adjustHeight(180);
    panel.hide();
  } else if (title === 'minimize') {
    adjustHeight(40, true);
  } else if (title === 'maximize') {
    adjustHeight(180);
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
