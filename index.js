/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const getVideoId = require('get-video-id');
const getYouTubeUrl = require('./lib/get-youtube-url.js');
const getVimeoUrl = require('./lib/get-vimeo-url.js');
const getVineUrl = require('./lib/get-vine-url.js');
const pageMod = require('sdk/page-mod');
const cm = require('sdk/context-menu');

const contextMenuLabel = 'Send to mini player';
const contextMenuContentScript = `
self.on('click', function (node, data) {
  self.postMessage(node.href);
});`;

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

const { getActiveView } = require('sdk/view/core');
getActiveView(panel).setAttribute('noautohide', true);

panel.port.on('message', opts => {
  const title = opts.action;

  if (title === 'send-to-tab') {
    const pageUrl = getPageUrl(opts.domain, opts.id, opts.time);
    if (pageUrl) require('sdk/tabs').open(pageUrl);
    else console.error('could not parse page url for ', opts); // eslint-disable-line no-console
    updatePanel({domain: '', src: ''});
    panel.hide();
  } else if (title === 'close') {
    updatePanel({domain: '', src: ''});
    panel.hide();
  } else if (title === 'minimize') {
    panel.hide();
    panel.show({
      height: 40,
      position: {
        bottom: 0,
        left: 10
      }
    });
  } else if (title === 'maximize') {
    panel.hide();
    panel.show({
      height: 180,
      position: {
        bottom: 10,
        left: 10
      }
    });
  } else if (title === 'record-event') {
    sendMetricsData(opts);
  }
});

function sendMetricsData(o) {
  let coords = getActiveView(panel).getBoundingClientRect();
  let appState = JSON.parse(o.data);

  // if the user activated the player, action should be 'activate'
  // if the user closed the player, action should be 'deactivate'
  // action is 'paused' if the user stopped playing ('playing' transitioning to false)

  // actions: 'activate', 'deactivate', 'play', 'pause', 0

  // NOTE: this packet follows a predefined data format and cannot be changed
  //       without notifying the data team. See docs/metrics.md for more.
  let data = {
    action: o.changed,
    activated_from: 'contextmenu', // always true for now
    domain: o.domain,
    doorhanger_prompted: false, // we have no doorhanger (yet)
    doorhanger_clicked: false,  // we have no doorhanger (yet)
    video_x: coords.top,
    video_y: coords.left,
    video_width: coords.width,
    video_height: coords.height
  };
}

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

cm.Item({
  label: contextMenuLabel,
  context: cm.SelectorContext('[href*="youtube.com"], [href*="youtu.be"]'),
  contentScript: contextMenuContentScript,
  onMessage: (url) => {
    sendMetricsData({changed: 'activate', domain: 'youtube.com'});
    launchVideo({url: url,
                 domain: 'youtube.com',
                 getUrlFn: getYouTubeUrl});
  }
});

cm.Item({
  label: contextMenuLabel,
  context: [
    cm.URLContext(['*.youtube.com']),
    cm.SelectorContext('[class*="yt-uix-sessionlink"]')
  ],
  contentScript: contextMenuContentScript,
  onMessage: (url) => {
    sendMetricsData({changed: 'activate', domain: 'youtube.com'});
    launchVideo({url: url,
                 domain: 'youtube.com',
                 getUrlFn: getYouTubeUrl});
  }
});

cm.Item({
  label: contextMenuLabel,
  context: cm.SelectorContext('[href*="vimeo.com"]'),
  contentScript: contextMenuContentScript,
  onMessage: (url)=> {
    sendMetricsData({changed: 'activate', domain: 'vimeo.com'});
    launchVideo({url: url,
                 domain: 'vimeo.com',
                 getUrlFn: getVimeoUrl});
  }
});

cm.Item({
  label: contextMenuLabel,
  context: cm.SelectorContext('[href*="vine.co/v/"]'),
  contentScript: contextMenuContentScript,
  onMessage: function(url) {
    sendMetricsData({changed: 'activate', domain: 'vine.co'});
    launchVideo({url: url,
                 domain: 'vine.co',
                 getUrlFn: getVineUrl});
  }
});

function updatePanel(opts) {
  panel.port.emit('set-video', opts);
  panel.show();
}

function launchVideo(opts) {
  // opts {url: url, getUrlFn: getYouTubeUrl, domain: 'youtube.com'}
  const id = getVideoId(opts.url);
  updatePanel({domain: opts.domain, id: id, src: ''});
  opts.getUrlFn(id, function(err, streamUrl) {
    if (!err) updatePanel({src: streamUrl});
  });
}

// handle browser resizing
pageMod.PageMod({
  include: '*',
  contentScriptFile: './resize-listener.js',
  onAttach: function(worker) {
    worker.port.on('resized', function() {
      if (panel.isShowing) {
        panel.hide();
        panel.show();
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
        launchVideo(opts);
      } else if (opts.domain.indexOf('vimeo.com')  > -1) {
        opts.getUrlFn = getVimeoUrl;
        launchVideo(opts);
      }
    });
  }
});
