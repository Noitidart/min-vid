const getVideoId = require('get-video-id');
const qs = require('sdk/querystring');
const panelUtils = require('./panel-utils.js');

module.exports = launchVideo;

// Pass in a video URL as opts.src or pass in a video URL lookup function as opts.getUrlFn
function launchVideo(opts) {
  const panel = panelUtils.getPanel();
  // TODO: if the panel's not ready, should we just wait for it?
  if (!panel) throw new Error('launchVideo called, but panel is falsy');
  // opts {url: url,
  //       getUrlFn: getYouTubeUrl,
  //       domain: 'youtube.com',
  //       time: 16 // integer seconds OPTIONAL
  //       src: streamURL or ''}
  let id;

  // TODO: submit a fix to getVideoId for this. #226
  if (opts.url.indexOf('attribution_link') > -1) {
    id = getIdFromAttributionLink(opts.url);
  } else {
    id = getVideoId(opts.url);
  }

  panel.port.emit('set-video', {domain: opts.domain, id: id, src: opts.src || ''});
  panel.show();
  if (!opts.src) {
    opts.getUrlFn(id, function(err, streamUrl) {
      // Be careful not to close over the outer panel reference.
      const panel = panelUtils.getPanel();
      if (!err) {
        panel.port.emit('set-video', {src: streamUrl});
        panel.show();
      }
    }, opts.time);
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
