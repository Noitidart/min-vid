/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const { getActiveView } = require('sdk/view/core');
const pageMod = require('sdk/page-mod');

const getYouTubeUrl = require('./lib/get-youtube-url');
const getVimeoUrl = require('./lib/get-vimeo-url');
const launchVideo = require('./lib/launch-video');
const sendMetricsData = require('./lib/send-metrics-data');
const contextMenuHandlers = require('./lib/context-menu-handlers');

let browserResizeMod, launchIconsMod, panel;

exports.main = function() {
	panel = require('sdk/panel').Panel({
		contentURL: './default.html',
		contentScriptFile: './controls.js',
		width: 320,
		height: 180,
		position: {
			bottom: 10,
			left: 10
		}
	});

  // Keep the panel open when it loses focus.
  getActiveView(panel).setAttribute('noautohide', true);

  // handle browser resizing
  browserResizeMod = pageMod.PageMod({
    include: '*',
    contentScriptFile: './resize-listener.js?cachebust=' + Date.now(),
    onAttach: function(worker) {
      worker.port.on('resized', function() {
        if (panel && panel.isShowing) {
					const xulPanel = getActiveView(panel);
					xulPanel.moveToAnchor(xulPanel.ownerDocument.documentElement, 'bottomleft bottomleft', 10, -10);
				}
      });
    }
  });

  // add launch icon to video embeds
  launchIconsMod = pageMod.PageMod({
    include: '*',
    contentStyleFile: './icon-overlay.css?cachebust=' + Date.now(),
    contentScriptFile: './icon-overlay.js?cachebust=' + Date.now(),
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
      worker.port.on('metrics', sendMetricsData);
    }
  });

  contextMenuHandlers.init(panel);
};
exports.onUnload = function(reason) {
  panel.destroy();
  contextMenuHandlers.destroy();
  browserResizeMod.destroy();
  launchIconsMod.destroy();
};
