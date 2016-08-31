/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

self.port && self.port.on('set-video', opts => {
  opts = Object.assign(opts, {
    loaded: false,
    error: false,
    progress: 0,
    playing: false,
    volume: '0.5'
  });
  unsafeWindow.AppData = Object.assign(unsafeWindow.AppData, opts);
});

// TODO: just until the WebCHannel is wired up, auto-toggle the src
setTimeout(() => {
  console.log('time is up, data/controls.js about to reset the src');
  // TODO: where did unsafeWindow go?
  AppData.src = 'https://www.youtube.com/embed/dYFALyP2e7U/?autoplay=0&modestbranding=1&controls=0&disablekb=0&enablejsapi=1&fs=0&iv_load_policy=3&loop=0&rel=0&showinfo=0';
}, 3000);

// Bridge between app.js window messages to the
// addon. We pass true for the wantsUntrusted param
// in order to access the message events. #82
window.addEventListener('addon-message', function(ev) {
  self.port && self.port.emit('addon-message', ev.detail);
}, false, true);
