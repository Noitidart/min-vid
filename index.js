/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

/* global Services */

const {Cu} = require('chrome');
const self = require("sdk/self");

Cu.import('resource://gre/modules/Services.jsm');

const getVideoId = require('get-video-id');
const getYouTubeUrl = require('./lib/get-youtube-url.js');
const getVimeoUrl = require('./lib/get-vimeo-url.js');
const getVineUrl = require('./lib/get-vine-url.js');
const getDocumentDimensions = require('./lib/get-document-dimensions.js');
const Transport = require('./lib/transport.js');
const pageMod = require('sdk/page-mod');
const cm = require('sdk/context-menu');

const URLS = {
  'vimeo': ['vimeo.com/'],
  'youtube': ['youtube.com/', 'youtu.be/'],
  'vine': ['vine.co/']
}

// Given a video service name from the URLS object, return an href *= selector
// for the corresponding urls.
// Arguments:
//   videoService: a key from URLS or '*' for all domains from URLS
//   shouldEncode: (optional) encode domains if true
function getSelectors(videoService, shouldEncode) {
  let domains = [];
  if (videoService in URLS) {
    domains = URLS[videoService]
  } else if (videoService === '*') {
    domains = Object.keys(URLS).map(name => URLS[name])
                               .reduce((prev, curr) => prev.concat(curr))
  } else {
    console.error(`Error: ${videoService} missing or not supported`) // eslint-disable-line no-console
  }
  const selectors = domains.map(url => `[href*="${shouldEncode ? encodeURIComponent(url) : url}"]`)
                           .reduce((prev, curr) => `${prev}, ${curr}`)
  return selectors;
}

const contextMenuLabel = 'Send to mini player';
const contextMenuContentScript = `
self.on('click', function (node, data) {
  self.postMessage(node.href);
});`;

let dimensions = getDocumentDimensions();

class Panel {
	constructor(opts) {
		// opts from the sdk panel: { contentURL, contentScriptFile, width, height, position: { bottom, left }

		this.opts = opts; // wtfever
		// this.port = new Transport(self.data.url(this.opts.contentURL));
		this.port = new Transport({
		  domain: 'resource://min-vid/data/default.html',
		  frameSelector: '#minvid-frame'
		});
		// TODO: just experimenting. see if we can catch the first message from the frame.
		this.port.on('frame-loaded', evt => {
		  console.log('frame-loaded message received by chrome', evt);
		  // TODO: store whatever you need here (domain? c
		});

		// panel is instantiated on first show() call
		this.el = null;
		// keep a pointer to the panel iframe for convenience
		this.frame = null;
		// window pointer is used to anchor the popup in the show() call
		this.win = null;

		// dimensions change when minimizing or resizing
		this.height = this.opts.height || 180;
		this.width = this.opts.width || 320;

		// TODO: figure out what to do with position
		this.position = this.opts.position;

		// TODO: find a cleaner way // 'this is why we can't have nice things'
		this.show = this.show.bind(this);
		this.hide = this.hide.bind(this);

		this._createPanel();
	}

	// _createPanel sets this.el and inserts the panel into the DOM
	_createPanel() {
		// Note: win is a XUL window, not a DOM window
		this.win = Services.wm.getMostRecentWindow('navigator:browser');

		this.el = this.win.document.createElement('panel');
		this.el.setAttribute('style', '-moz-appearance: none; border: 0; margin: 0');
		this.el.setAttribute('noautohide', true);
		// backdrag makes the background area of the panel draggable
		this.el.setAttribute('backdrag', true);

		this.frame = this.win.document.createElement('iframe');
		// TODO: might need to use frame.setAttribute. not sure.
		this.frame.width = this.width;
		this.frame.height = this.height;
		this.frame.id = 'minvid-frame';
		// TODO: append a querystring to the contentURL to enable multiple minvid panels?
		this.frame.setAttribute('src', self.data.url(this.opts.contentURL));
		this.el.appendChild(this.frame);

		let label = this.win.document.createElement('label');
		// TODO: not sure this id is needed
		label.id = 'backdragspot';
		label.setAttribute('value', 'click here to drag the thing'); // just for testing
		label.setAttribute('style', 'border: 1px solid black');
		// Start off with the drag handle hidden; unhide it on hover
		label.setAttribute('hidden', true);
		this.el.appendChild(label);

		this.el.onmouseenter = () => {
			label.setAttribute('hidden', false);
		};

		this.el.onmouseleave = () => {
			label.setAttribute('hidden', true);
			// TODO: panel doesn't auto-shrink when the label is hidden. manually reset its size.
			this.el.sizeTo(this.width, this.height);
		};

		this.win.document.documentElement.appendChild(this.el);

		// let's put a pointer out there, so we can play with this stuff
		this.win.minVidPanel = this;
	}

	show(opts) {
		// lazily create the panel
		if (!this.el) {
			this._createPanel();
		}

		// map opts onto popup state
		this.height = opts && opts.height || this.height;
		this.position = opts && opts.position || this.position;
			
		// reset size because you can't resize from openPopup
		this.el.sizeTo(this.width, this.height);
		// TODO: not sure about the position shorthand values (2nd arg)
		this.el.openPopup(this.win.document.documentElement, 'bottomleft bottomleft', this.position.left, this.position.bottom, false, false);
	}

	hide() {
		this.el.hidePopup();
	}

	get isShowing() {
	  // hard-coded for now, not sure getters can be bound
	  return false;
		// return this.el && this.el.state == 'open';
	}
}

const panel = new Panel({
  contentURL: './default.html',
  contentScriptFile: './controls.js',
  width: 320,
  height: 180,
  position: {
    bottom: 10,
    left: 10
  }
});

panel.port.on('addon-message', opts => {
  console.log('index.js addon-message callback called, opts is ', opts);
  const title = opts.type;

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
  } else if (title === 'metrics-event') {
    sendMetricsData(opts);
  }
});

function sendMetricsData(o) {
  if (!panel.el) { return; } // TODO: fix. caused by lazy-loading the panel, metrics tries to check it before it exists
  const coords = panel.el.getBoundingClientRect();


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
  context: cm.SelectorContext(getSelectors('youtube')),
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
  context: cm.SelectorContext(getSelectors('vimeo')),
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
  context: cm.SelectorContext(getSelectors('vine')),
  contentScript: contextMenuContentScript,
  onMessage: function(url) {
    sendMetricsData({changed: 'activate', domain: 'vine.co'});
    launchVideo({url: url,
                 domain: 'vine.co',
                 getUrlFn: getVineUrl});
  }
});

cm.Item({
  label: contextMenuLabel,
  context: [
    cm.URLContext(['https://vine.co/*']),
    cm.SelectorContext('video')
  ],
  contentScript: 'self.on("click", function (node, data) {' +
              ' self.postMessage(node.poster);' +
              ' });',
  onMessage: function(url) {
    const mp4 = url.replace(/thumbs/, 'videos').split(/\.jpg/)[0];
    launchVideo({url: url,
                domain: 'vine.co',
                src: mp4});
  }
});

cm.Item({
  label: contextMenuLabel,
  context: [
    cm.URLContext(['*.google.com']),
    cm.SelectorContext(getSelectors('*', true)),
  ],
  contentScript: contextMenuContentScript,
  onMessage: function(url) {
    const regex = /url=(https?[^;]*)/.exec(url)[1];
    const decoded = decodeURIComponent(regex).split('&usg')[0];
    let getUrlFn, domain;
    if (decoded.indexOf('youtube.com' || 'youtu.be') > -1) {
      getUrlFn = getYouTubeUrl;
      domain = 'youtube.com';
    } else if (decoded.indexOf('vimeo.com')  > -1) {
      getUrlFn = getVimeoUrl;
      domain = 'vimeo.com';
    } else if (decoded.indexOf('vine.co') > -1) {
      getUrlFn = getVineUrl;
      domain = 'vine.co';
    }
    if (domain && getUrlFn) {
      launchVideo({url: decoded,
        domain: domain,
        getUrlFn: getUrlFn});
    }
  }
});

function updatePanel(opts) {
  debugger;
  panel.port.emit('set-video', opts);
  panel.show();
}

// Pass in a video URL as opts.src or pass in a video URL lookup function as opts.getUrlFn
function launchVideo(opts) {
  // opts {url: url,
  //       getUrlFn: getYouTubeUrl,
  //       domain: 'youtube.com',
  //       src: streamURL or ''}
  const id = getVideoId(opts.url);
  updatePanel({domain: opts.domain, id: id, src: opts.src || ''});
  if (!opts.src) {
    opts.getUrlFn(id, function(err, streamUrl) {
      if (!err) updatePanel({src: streamUrl});
    });
  }
  // TODO: make sure the panel is still transparent
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

      // update our document dimensions
      dimensions = getDocumentDimensions();
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
