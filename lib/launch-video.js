const getVideoId = require('get-video-id');
const qs = require('sdk/querystring');
const tabs = require('sdk/tabs');
const { viewFor } = require("sdk/view/core");

const {Cu} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');


module.exports = launchVideo;

// Pass in a video URL as opts.src or pass in a video URL lookup function as opts.getUrlFn
function launchVideo(opts, panel) {
  if (!panel) throw new Error('panel needs to be provided as second argument');
  // opts {url: url,
  //       getUrlFn: getYouTubeUrl,
  //       domain: 'youtube.com',
  //       src: streamURL or ''}
  let id;

  // TODO: submit a fix to getVideoId for this. #226
  if (opts.url.indexOf('attribution_link') > -1) {
    id = getIdFromAttributionLink(opts.url);
  } else {
    id = getVideoId(opts.url);
  }

  panel.port.emit('set-video', {domain: opts.domain, id: id, src: opts.src || ''});
  // OK, how about this.
  // if the panel isn't in the document...what's the current document?
  // let's say, if the panel isn't part of the active window, then, hide it and re-show it.
  // or do we need to destroy it and create a new one in the new window?
  
  // TODO: this doesn't work. but I want to compare panel's parent document to the document of the most recent window,
  // which would be the window that got right-clicked, right?
  console.log('does the most recent window equal viewFor(panel).ownerGlobal? ', !!(Services.wm.getMostRecentWindow('navigator:browser') === (viewFor(panel) && viewFor(panel).ownerGlobal)) );

  panel.show();
  if (!opts.src) {
    opts.getUrlFn(id, function(err, streamUrl) {
      if (!err) {
        panel.port.emit('set-video', {src: streamUrl});
        panel.show();
      }
    });
  }
}

function getIdFromAttributionLink(url) {
  const matcher = 'attribution_link?';
  const idx = url.indexOf(matcher);
  const partialUrl = decodeURIComponent(url).substring(idx + matcher.length);
  const idMatcher = 'watch?';
  const idx2 = partialUrl.indexOf(idMatcher);
  return qs.parse(partialUrl.substring(idx2 + idMatcher.length)).v;
}
