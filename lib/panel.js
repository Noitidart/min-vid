const { Cu } = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');

const self = require('sdk/self');
const system = require('sdk/system');
const pageMod = require('sdk/page-mod');
const sendMetricsData = require('./send-metrics-data.js');
const { Panel } = require('sdk/panel');
const { getActiveView } = require('sdk/view/core');
const { setTimeout } = require('sdk/timers');
const getYouTubeUrl = require('./get-youtube-url.js');
const getVimeoUrl = require('./get-vimeo-url.js');
const launchVideo = require('./launch-video.js');
// TODO: any reason to keep this as a separate lib?
const makePanelDraggable = require('./make-panel-draggable.js');

let sdkPanel;
let pagemods = [];
let dimensions;
let userScreenCoords;
let userDimensions;
let userPanelOptions;

const DEFAULT_SCREEN_COORDS = {
  bottomOffset: -10,
  leftOffset: 10
};

const DEFAULT_DIMENSIONS = {
  height: 180,
  width: 320,
  minimizedHeight: 40
};

const DEFAULT_PANEL_OPTIONS = {
  contentURL: './default.html',
  contentScriptFile: './controls.js',
  position: {
    bottom: 10,
    left: 10
  }
};


function create(dimensions, panelOptions) {
  sdkPanel = _create(dimensions, panelOptions);
  _attachListeners(sdkPanel);
  _attachPageMods(sdkPanel);
}

function destroy() {
  _detachListeners(sdkPanel);
  _detachPageMods();
  sdkPanel.dispose();
  sdkPanel = null;
  _isPanelReady = false;
  panelReadyListeners = [];
}

let _isPanelReady = false;
let panelReadyListeners = [];

// When the panel is first opened, or reopened on a new window, there's a
// delay while the worker and port are initialized. If a function needs to
// send messages to the `port` of the `panel`, it should put that code in
// a callback and pass the callback to this function. See launchVideo for
// an example.
function whenPanelReady(cb) {
  // If the panel is already ready, just call the callback.
  // Otherwise, queue it up to be called when the worker sends a first message.
  if (_isPanelReady) {
    cb();
  } else {
    panelReadyListeners.push(cb);
  }
}

function _create(dimensions, panelOptions) {
  // create may be called by code that doesn't pass in the right arguments.
  // to avoid causing problems, just store the config as userDimensions and userPanelOptions,
  // then reuse those if no new argument is passed in :beers:
  userDimensions = dimensions || userDimensions || DEFAULT_DIMENSIONS;
  userPanelOptions = panelOptions || userPanelOptions || Object.assign(DEFAULT_PANEL_OPTIONS, userDimensions);
  // TODO: Just for now, stick with default coords
  userScreenCoords = DEFAULT_SCREEN_COORDS;

  if (sdkPanel) {
    console.error('panel.create called, but a panel already exists. Deleting old panel.');
    destroy();
  }
  const panel = Panel(userPanelOptions);
  panel.port.once('worker-ready', () => {
    _isPanelReady = true;
    console.log('ready event received. now the panel worker is ready.');
    // clear out the panelReady callbacks
    panelReadyListeners.forEach(cb => cb());
    panelReadyListeners = [];
    // TODO: add a timeout that calls errbacks if the worker is never ready
  });
  getActiveView(panel).setAttribute('noautohide', true);

  // Draggability seems to work for windows and mac, but not linux.
  if (system.platform === 'winnt' || system.platform === 'darwin') {
    // We have to wait until XBL has initialized before changing the 'type'.
    // TODO: we can copy the SDK panel and check for existence of getActiveView(sdkPanel).popupOpen
    // instead of naively waiting 5 seconds.
    //setTimeout(() => { makePanelDraggable(panel, userDimensions); }, 5000);
  }

  return panel;
}

function updateWindow() {
  if (!sdkPanel) return console.error('updateWindow called, but no panel exists');
  const currentWindow = Services.wm.getMostRecentWindow('navigator:browser');
  const panelWindow = getActiveView(sdkPanel) && getActiveView(sdkPanel).ownerGlobal;

  if (currentWindow !== panelWindow) {
    console.log('destroying old, then creating new');
    destroy();
    create(userDimensions, userPanelOptions);
  }
}

// TODO: seems like exporting the sdkPanel directly always leaves it undefined
function getPanel() {
  return sdkPanel;
}

function _attachListeners(panel) {
  if (!panel) {
    console.error('_attachListeners exiting: panel is falsy');
    return;
  }
  if (!panel.port) {
    console.error('_attachListeners exiting: panel.port is falsy');
    return;
  }

  panel.port.on('addon-message', _onAddonMessage);
}

function _detachListeners(panel) {
  if (!panel) {
    console.error('_detachListeners exiting: panel is falsy');
    return;
  }
  if (!panel.port) {
    console.error('_detachListeners exiting: panel.port is falsy');
    return;
  }

  panel.port.removeListener('addon-message', _onAddonMessage);
}

function _onAddonMessage(opts) {
  const panel = getPanel();

  const title = opts.action;

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

  if (title === 'send-to-tab') {
    const pageUrl = getPageUrl(opts.domain, opts.id, opts.time);
    if (pageUrl) require('sdk/tabs').open(pageUrl);
    else {
      console.error('could not parse page url for ', opts); // eslint-disable-line no-console
      panel.port.emit('set-video', {error: 'Error loading video from ' + opts.domain});
    }
    panel.port.emit('set-video', {domain: '', src: ''});
    // TODO: destroy?
    //panel.hide();
    destroy();
  } else if (title === 'close') {
    panel.port.emit('set-video', {domain: '', src: ''});
    // TODO: destroy?
    //panel.hide();
    destroy();
  } else if (title === 'minimize') {
    adjustHeight(dimensions.minimizedHeight);
  } else if (title === 'maximize') {
    adjustHeight(dimensions.height);
  } else if (title === 'metrics-event') {
    sendMetricsData(opts, panel);
  }
}

// TODO: pagemod scripts aren't detached from existing pages when removed. need to manually do this.
function _attachPageMods(panel) {
  // handle browser resizing
  pagemods.push(pageMod.PageMod({
    include: '*',
    contentScriptFile: './resize-listener.js',
    onAttach: function(worker) {
      worker.port.on('resized', function() {
        // TODO: should I replace panel with panelUtils.getPanel() ?
        if (panel.isShowing) {
          redrawPanel();
        }
        // TODO: is this pointless? is the worker closure preventing the worker from being GC'd?
        worker.on('detach', () => { delete worker; });
      });
    }
  }));

  // add launch icon to video embeds
  pagemods.push(pageMod.PageMod({
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
      
      worker.on('detach', () => { delete worker; });
    }
  }));
}

function _detachPageMods() {
  pagemods.forEach(pagemod => pagemod.destroy());
  pagemods = [];
}

function redrawPanel() {
  const panel = getPanel();
  if (!panel) return console.error('adjustHeight called but sdkPanel is falsy');

  const xulPanel = getActiveView(panel);
  const doc = xulPanel.ownerDocument;

  xulPanel.moveToAnchor(doc.documentElement, 'bottomleft bottomleft', userScreenCoords.leftOffset, userScreenCoords.bottomOffset);
}

function adjustHeight(newHeight) {
  const panel = getPanel();
  if (!panel) return console.error('adjustHeight called but sdkPanel is falsy');

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

module.exports = {
  create: create,
  destroy: destroy,
  updateWindow: updateWindow,
  getPanel: getPanel,
  redrawPanel: redrawPanel,
  adjustHeight: adjustHeight,
  whenPanelReady: whenPanelReady
};
