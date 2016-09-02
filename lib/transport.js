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

function Transport(frameBaseURL) {
  this.subscribers = {};

  // Public API
  this.on = this.on.bind(this);
  this.emit = this.emit.bind(this);
  this.onContentMessage = this.onContentMessage.bind(this);

  // Quickly validate the URL using nsIURI.
  try {
    Services.io.newURI(frameBaseURL, null, null);
    this.frameBaseURL = frameBaseURL;
  } catch (ex) {
    const msg = `Unable to create transport: frameBaseURL "${frameBaseURL}" is invalid: `;
    throw new Error(msg, ex);
  }

  // If we want multiple independent per-window transports, then the 
  // channelId must be unique to each window.
  // TODO: just using one global channel while debugging.
  // this.channelId = 'minvid-' + Math.floor(Math.random() * 100000);
  this.channelId = 'minvid';

  // TODO: OH WAIT! should we be passing in the full path or just the 'domain'?
  this.frameBaseURL = 'resource://min-vid';

  console.log(`lib/transport: frameBaseURL is ${this.frameBaseURL}`);
  this.port = new WebChannel(this.channelId, Services.io.newURI(this.frameBaseURL, null, null));
  this.port.listen((msg) => {
    console.log('this.port.listen fired!!!');
    this.onContentMessage(msg);
  });

  // Make sure the port is disconnected when the add-on is unloaded.
  /* TODO: make this work
  ensure(() => {
    if (this.port) {
      this.port.stopListening();
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
    const ctx = {
      // TODO: markh thought this might work. gBrowser is a tabbrowser, we just want a single browser.
      browser: Services.wm.getMostRecentWindow('navigator:browser').gBrowser.selectedBrowser,

      // TODO: Is this the right principal? See nsIScriptSecurityManager.idl for API docs.
      // principal: Services.scriptSecurityManager.createCodebasePrincipalFromOrigin(this.frameBaseURL)
      // TODO: not sure a resource:// URI can be used like that ^^. system principal for now.
      principal: Services.scriptSecurityManager.getSystemPrincipal()
    };
    this.port.send(msg, ctx);
  },
  onContentMessage: function(id, msg, sender) {
    console.log('onContentMessage called: id, msg, sender are: ', id, msg, sender);
    if (id !== this.channelId) { return; }

    // TODO: maybe we store sender here? or check sender against something else?
    if (msg.type in this.subscribers) {
      this.subscribers[msg.type].forEach(cb => { cb(id, msg, sender) });
    }
  }
};
module.exports = Transport;
