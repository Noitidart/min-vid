/* global Services */

const {Cu} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');

const { getActiveView } = require('sdk/view/core');
const panelUtils = require('./panel.js');

module.exports = sendMetricsData;

// TODO: let's stop passing panel around and get it from lib/panel.js instead
// TODO: just using panelUtils.sdkPanel does NOT seem to work properly.
function sendMetricsData(o) {
  return; // TODO: it's busted. dunno why. bail for now.
  const panel = panelUtils.getPanel();
  if (!panel) {
    console.error('called sendMetricsData, but the panel is gone');
    return;
  }
  const coords = getActiveView(panel).getBoundingClientRect();

  // NOTE: this packet follows a predefined data format and cannot be changed
  //       without notifying the data team. See docs/metrics.md for more.
  const data = {
    object: o.object,
    method: o.method,
    domain: o.domain,
    'played_count': o.playedCount,
    video_x: coords.top,
    video_y: coords.left,
    video_width: coords.width,
    video_height: coords.height
  };

  const subject = {
    wrappedJSObject: {
      observersModuleSubjectWrapper: true,
      object: '@min-vid'
    }
  };
  Services.obs.notifyObservers(subject, 'testpilot::send-metric', JSON.stringify(data));
}
