/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

// panel utils:
// getPanel(): gets a panel reference. Pass the getter inside closures,
//             instead of the panel itself, so the panel can be freed when needed.
// create(): creates a panel. Note that code that needs the panel to be ready
//           should register a callback with whenPanelReady().
// destroy(): destroys a panel.
// whenPanelReady(): register a callback that will fire immediately, if the panel's
//                   ready; otherwise,, it'll fire when the panel is ready.
//                   Note that the list of callbacks is cleared when the panel is
//                   destroyed, so you need to create() first, then call this method.


// Note: keeping this whenPanelReady bit state sectioned off in case
// we replace it with a Task or Promise eventually.
const whenPanelReady = (function() {
  let isPanelReady = false;
  let panelInDocument = false;
  let panelReadyListeners = [];

  function _whenPanelReady(cb) {
    isPanelReady ? cb() : panelReadyListeners.push(cb);
  }

  // When the panel is destroyed, call reset() to clear callbacks.
  _whenPanelReady.reset = function whenPanelReady__reset() {
    isPanelReady = false;
    panelInDocument = false;
    panelReadyListeners = [];
  };

  // When the panel is ready, call ready() to fire callbacks.
  _whenPanelReady.ready = function whenPanelReady__ready() {
    panelReadyListeners.forEach(cb => {
      try {
        cb();
      } catch (ex) {
        console.error('Panel ready listener threw when invoked: ', ex);
      }
    });
    panelReadyListeners = [];
  };

  return _whenPanelReady;
})();

let sdkPanel;
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

// TODO: Ensure we can abort at any point in this lengthy setup process.
function create(dimensions, panelOptions) {
  // Sequence of events:
  // 0. Destroy the panel, if it exists.
  if (sdkPanel) {
    console.error('panel.create called, but a panel already exists. Deleting old panel.');
    destroy();
  }

  // 1. Register listeners to be attached after the panel is ready.
  whenPanelReady(() => {
    // TODO: remove before landing, just making sure scoping is working properly
    console.log('inside whenPanelReady, sdkPanel is ', sdkPanel);
    sdkPanel.port.on('addon-message', _onAddonMessage);
  });

  // 2. Create the panel and set the userDimensions, userPanelOptions,
  //    userScreenCoords module globals.
  sdkPanel = _create(dimensions, panelOptions);

  // 3. Once the panel is in the XUL DOM (after _checkPanel calls the cb),
  //    modify the element's attributes and make it draggable (on Windows
  //    or Mac). Reseat in the XUL DOM to trigger the native Panel XBL code
  //    to run again.
  _checkPanel(() => {
    let xulPanel = getActiveView(sdkPanel);
    xulPanel.setAttribute('noautohide', true);
    xulPanel.setAttribute('level', 'top');

    // Draggability seems to work for windows and mac, but not linux.
    if (system.platform === 'winnt' || system.platform === 'darwin') {
      makePanelDraggable(sdkPanel, userDimensions);
    } else {
      // If we don't enable dragging, we still need to reseat the element
      // to get XBL to re-run with the other attribute changes.
      xulPanel.parentNode.replaceChild(xulPanel, xulPanel);
    }

    // Because we just modified the underlying XBL, we need to again wait for
    // the panel to be loaded and reinserted into the XUL DOM.
    _checkPanel(() => {
      // 4. Register panel load listener (panel.port.once('worker-ready', ... )).
      //    The content scripts are loaded after the panel and iframe are fully
      //    loaded, so when the content script sends a worker-ready ping, we know
      //    the panel is fully initialized.
      // TODO: if this ever throws, then we need to add a `panel.port` check to _checkPanel.
      sdkPanel.port.once('worker-ready', () => {
        // 5. After worker-ready, and after the draggable panel is found in the XUL
        //    DOM, call the whenPanelReady callbacks; we're done.

        whenPanelReady.ready();
      });

      // Because we use a setTimeout loop to wait for the panel to appear in the
      // XUL DOM, we might miss the worker-ready signal. So, try to ask the 
      // content script to send the worker-ready signal; if it throws, it's not
      // ready yet, so we are fine to wait. If it was fully initialized, it'll
      // resend the worker-ready signal, and initialization will continue.
      try {
        sdkPanel.port.emit('worker-ready-check');
      } catch (ex) {}
    });
  });
}

function _create(dimensions, panelOptions) {
  // create() may be called by code that doesn't pass in the right arguments.
  // To avoid causing problems, just store the config as userDimensions and userPanelOptions,
  // then reuse those if no new argument is passed in. :beers:
  userDimensions = dimensions || userDimensions || DEFAULT_DIMENSIONS;
  userPanelOptions = panelOptions || userPanelOptions || Object.assign(DEFAULT_PANEL_OPTIONS, userDimensions);
  // TODO: Just for now, stick with default coords
  userScreenCoords = DEFAULT_SCREEN_COORDS;

  return require('sdk/panel').Panel(userPanelOptions);
}

function destroy() {
  sdkPanel.port.removeListener('addon-message', _onAddonMessage);
  sdkPanel.dispose();
  sdkPanel = null;
  whenPanelReady.reset();
}

function getPanel() {
  return sdkPanel;
}

// Call cb after the panel is in the XUL DOM and is a registered SDK view.
// The checkCount can be omitted; it's used to track the recursion count.
function _checkPanel(cb, checkCount) {
  if (typeof checkCount != 'number') { return _checkPanel(cb, 1) }
  
  if (getActiveView(sdkPanel) && _getXulPanel()) return cb();

  // TODO: if the check fails, should we destroy and create again? or just give up?
  // TODO: is 10 seconds not long enough on ancient hardware?
  if (checkCount > 100) return console.error('unable to find panel after 10 seconds');
  console.log('no view found for sdkPanel; waiting 100 msec');
  setTimeout(_checkPanel(cb, ++checkCount), 100);
  return;
}

function _getXulPanel() {
  const currentWindow = Services.wm.getMostRecentWindow('navigator:browser');
  const popups = currentWindow.document.getElementById('mainPopupSet');
  const frame = popups.lastElementChild;

  const isSdkPopup = frame.hasAttribute('sdkscriptenabled');
  const minVidBackgroundFrame = 'backgroundFrame' in frame && frame.backgroundFrame.getAttribute('src').indexOf('min-vid') > -1;
  const minVidViewFrame = 'viewFrame' in frame && frame.viewFrame.getAttribute('src').indexOf('min-vid') > -1;

  // if it's an sdk popup, and one of the frames has a min-vid src, it's the one we want.
  return isSdkPopup && (minVidBackgroundFrame || minVidViewFrame);
}

module.exports = {
  whenPanelReady: whenPanelReady,
  create: create,
  destroy: destroy,
  getPanel: getPanel
};
