const getVideoId = require('get-video-id');
const qs = require('sdk/querystring');
const tabs = require('sdk/tabs');
const { getOwnerWindow } = require('sdk/tabs/utils');
const { viewFor } = require("sdk/view/core");

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
  // Choose the currently-selected XUL tab as the anchor.
  panel.show({}, getOwnerWindow(viewFor(tabs.activeTab)).document.documentElement );
  if (!opts.src) {
    opts.getUrlFn(id, function(err, streamUrl) {
      if (!err) {
        panel.port.emit('set-video', {src: streamUrl});
        panel.show({}, getOwnerWindow(viewFor(tabs.activeTab)).document.documentElement );
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
