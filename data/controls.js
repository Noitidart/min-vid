/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

console.log('data/controls.js loaded');

// When the window loads, send a WebChannel message to chrome to initialize the channel.
function connect() {
  function _onWindowLoaded() {
    let event = new window.CustomEvent('WebChannelMessageToChrome', {
      detail: JSON.stringify({ type: 'frame-loaded' })
    });
    window.dispatchEvent(event);
  };

  if (window.document.readyState === 'complete') {
    _onWindowLoaded();
  } else {
    window.onload = _onWindowLoaded;
  }
}
connect();

// webchannel ID sent over by chrome
// TODO: while debugging, just using one global static name
let channelId = 'minvid';

window.addEventListener("WebChannelMessageToContent", function(e) {
  console.log('controls.js received postmessage event: ', e);

  // TODO: uncomment when we figure out channel initialization sequence
  //channelId = e.detail.id;

  if (e.detail.message.type == 'set-video') {
    let opts = Object.assign(e.detail.message.data, {
      loaded: false,
      error: false,
      progress: 0,
      playing: false,
      volume: '0.5'
    });
    unsafeWindow.AppData = Object.assign(unsafeWindow.AppData, opts);
  }
});

// Bridge between app.js window messages to the
// addon. We pass true for the wantsUntrusted param
// in order to access the message events. #82
// TODO: port this to webchannel
window.addEventListener('addon-message', function(ev) {
  if (!channelId) {
    console.error('content tried to send a message before addon initialized webchannel id: ', ev);
    return;
  }

  window.dispatchEvent(new window.CustomEvent("WebChannelMessageToChrome", {
    detail: JSON.stringify({
      id: channelId,
      message: {
        type: 'addon-message',
        data: ev.detail
      }
    })
  }));
}, false, true);
