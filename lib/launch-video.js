const getVideoId = require('get-video-id');
const qs = require('sdk/querystring');
const windowUtils = require('./window-utils');

module.exports = launchVideo;

// Pass in a video URL as opts.src or pass in a video URL lookup function as opts.getUrlFn
function launchVideo(opts) {
  // UpdateWindow might create a new panel, so do the remaining launch work
  // asynchronously.
  windowUtils.updateWindow();
  windowUtils.whenReady(() => {
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

    windowUtils.show();
    windowUtils.send('set-video', {
      domain: opts.domain,
      id: id,
      src: opts.src || '',
      volume: opts.volume,
      muted: opts.muted
    });
    if (!opts.src) {
      opts.getUrlFn(id, function(err, streamUrl) {
        if (err) console.error('LaunchVideo failed to get the streamUrl: ', err); // eslint-disable-line no-console
        windowUtils.send('set-video', {src: streamUrl, error: Boolean(err)});
      }, opts.time);
    }
  });
}

function getIdFromAttributionLink(url) {
  const matcher = 'attribution_link?';
  const idx = url.indexOf(matcher);
  const partialUrl = decodeURIComponent(url).substring(idx + matcher.length);
  const idMatcher = 'watch?';
  const idx2 = partialUrl.indexOf(idMatcher);
  return qs.parse(partialUrl.substring(idx2 + idMatcher.length)).v;
}
