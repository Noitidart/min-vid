const getVideoId = require('get-video-id');
const { setTimeout } = require('sdk/timers');
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

  // We could use a promise. for now, just do this:
  finishLaunch(panel, opts, id);
}

let waitCount = 0;
function finishLaunch(panel, opts, id) {
  // TODO: could we listen for a worker ready event isntead of polling?
  // TODO: maybe the create() function could wait till the port is wired up, and then resolve.
  if (!('port' in panel)) {
    // wait for stuff to get initialized properly
    if (waitCount > 10) {
      console.error('launch-video has been waiting a really long time to finish launching :-0');
      return;
    }
    waitCount++;
    setTimeout(finishLaunch, 50);
    return;
  }
  console.log('yay, finally ready after ', waitCount, ' timeouts');
  waitCount = 0;
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
