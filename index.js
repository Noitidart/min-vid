/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const { getActiveView } = require('sdk/view/core');
const { setTimeout } = require('sdk/timers');
const initContextMenuHandlers = require('./lib/context-menu-handlers.js');
const panelUtils = require('./lib/panel.js');


const dimensions = {
  width: 320,
  height: 180,
  minimizedHeight: 40
};

const panelOptions = {
  contentURL: './default.html?cachebust=' + Date.now(),
  contentScriptFile: './controls.js?cachebust=' + Date.now(),
  width: dimensions.width,
  height: dimensions.height,
  position: {
    bottom: 10,
    left: 10
  }
};

// TODO: I think we actually don't need a panel pointer here, since we can
// always get it from panelUtils.getPanel() ^_^
setTimeout(() => { panelUtils.create(dimensions, panelOptions) }, 5000);

// add 'send-to-mini-player' option to context menu
initContextMenuHandlers();
