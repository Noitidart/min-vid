const getVideoId = require('get-video-id');
const qs = require('sdk/querystring');
const tabs = require('sdk/tabs');
const panelUtils = require('./panel.js');

module.exports = launchVideo;

// Pass in a video URL as opts.src or pass in a video URL lookup function as opts.getUrlFn
function launchVideo(opts) {
  if (!panelUtils.getPanel()) {
    console.error('launchVideo called, but the panel does not exist. creating...');
    panelUtils.create(); // TODO: how do we ensure the right options are used?
  }
  const panel = panelUtils.getPanel();
  console.log('inside launchVideo. panel is ', panel);

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

  // Make sure the panel is attached to the current window.
  panelUtils.updateWindow();

  panel.port.emit('set-video', {domain: opts.domain, id: id, src: opts.src || ''});
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
