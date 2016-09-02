'use strict';

// changes vs univ srch addon:
// - app.broker is gone, it's just using on/emit like SDK / postmessage
// - SDK imports / exports, not XPCOM style

// transport wraps the WebChannel and is exposed via the main pubsub broker.
// The transport also knows how to transform events into the form expected by
// the iframe. This is a little weird, but keeps individual UI objects ignorant
// of the transport.

/* global Components, Services, WebChannel, XPCOMUtils */

const {Cu} = require('chrome');

const {when, ensure} = require('sdk/system/unload');

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services',
  'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'WebChannel',
  'resource://gre/modules/WebChannel.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'console',
  'resource://gre/modules/Console.jsm');

// opts := { domain, frameSelector }
// domain: scheme + domain for same-origin messaging. currently using 'resource://min-vid/'
// frameSelector: used to uniquely ID the iframe in the window.
function Transport(opts) {
  this.subscribers = {};

  // TODO validate frameSelector
  this.frameSelector = opts.frameSelector;

  // Public API
  this.on = this.on.bind(this);
  this.emit = this.emit.bind(this);
  this.onContentMessage = this.onContentMessage.bind(this);

  // Quickly validate the URL using nsIURI.
  try {
    Services.io.newURI(opts.domain, null, null);
    this.domain = opts.domain;
  } catch (ex) {
    const msg = `Unable to create transport: domain "${domain}" is invalid: `;
    throw new Error(msg, ex);
  }

  // If we want multiple independent per-window transports, then the 
  // channelId must be unique to each window.
  // TODO: just using one global channel while debugging.
  // this.channelId = 'minvid-' + Math.floor(Math.random() * 100000);
  this.channelId = 'minvid';

  console.log(`lib/transport: domain is ${this.domain}`);
  this.webChannel = new WebChannel('minvid', Services.io.newURI(this.domain, null, null));
  this.webChannel.listen((id, msg, target) => {
    console.log('this.webChannel.listen fired!!!', id, msg, target);
    this.onContentMessage(id, msg, target);
  });

  // Make sure the port is disconnected when the add-on is unloaded.
  /* TODO: make this work
  ensure(() => {
    if (this.webChannel) {
      this.webChannel.stopListening();
    }
  });
  */
}

Transport.prototype = {
  constructor: Transport,
  on: function(evt, cb) {
    console.log('transport.on called. evt is ', evt, ', cb is ', cb);
    if (!(evt in this.subscribers)) {
      this.subscribers[evt] = [];
    }
    this.subscribers[evt].push(cb);
  },
  emit: function (evt, data) {
    console.log('transport.emit called. evt is ', evt, ', data is ', data);
    const msg = JSON.stringify({
      type: evt,
      data: data || null
    });

    /* Uncomment for debugging: */
    try {
      console.log(`Sending the ${evt} message to content: `, msg);
    } catch (ex) {
      console.error(`Failed to send the ${evt} message to content due to malformed data: `, ex);
    }
    /**/

    // IF we haven't received a message from content yet, then we can't proceed.
    if (!this.target) {
      throw new Error('tried to emit before receiving startup message from content, TODO deal with this');
    }
    let browser = Services.wm.getMostRecentWindow('navigator:browser').gBrowser.selectedBrowser;
    const ctx = {
      // TODO: markh thought this might work. gBrowser is a tabbrowser, we just want a single browser.
      browser: browser,

      // TODO: Is this the right principal? See nsIScriptSecurityManager.idl for API docs.
      // principal: Services.scriptSecurityManager.createCodebasePrincipalFromOrigin(this.domain)
      // TODO: not sure a resource:// URI can be used like that ^^. system principal for now.
      principal: Services.scriptSecurityManager.getSystemPrincipal(),

      eventTarget: this.target
    };
    this.webChannel.send(msg, ctx);
  },
  onContentMessage: function(id, msg, target) {
    this.target = target;
    console.log('onContentMessage called: id, msg, target are: ', id, msg, target);
    if (id !== this.channelId) { return; }

    // TODO: maybe we store target here? or check target against something else?
    if (msg.type in this.subscribers) {
      this.subscribers[msg.type].forEach(cb => { cb(id, msg, target) });
    }
  }
};
module.exports = Transport;
