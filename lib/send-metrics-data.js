/* global Services */

const {Cu} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');

const { setTimeout } = require('sdk/timers');

module.exports = sendMetricsData;

function sendMetricsData(o, win) {
  // Note: window ref is optional, used to avoid circular refs with window-utils.js.
  win = win || require('./window-utils.js').getWindow();

  // If the window's missing, try again a few seconds later.
  if (!win) {
    return setTimeout(() => { sendMetricsData(o) }, 10 * 1000);
  }

  const coords = win.document.documentElement.getBoundingClientRect();

  // NOTE: this packet follows a predefined data format and cannot be changed
  //       without notifying the data team. See docs/metrics.md for more.
  const data = {
    object: o.object,
    method: o.method,
    domain: o.domain,
    video_x: coords.left,
    video_y: coords.top,
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
