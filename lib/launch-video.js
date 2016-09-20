const getVideoId = require('get-video-id');
const { setTimeout } = require('sdk/timers');
const qs = require('sdk/querystring');
const tabs = require('sdk/tabs');
const panelUtils = require('./panel.js');

module.exports = launchVideo;

// Pass in a video URL as opts.src or pass in a video URL lookup function as opts.getUrlFn
function launchVideo(opts) {
  const panel = panelUtils.getPanel();
  // If the panel exists, if it's on the wrong window, delete and re-create on
  // the now-current window. If the panel doesn't exist, create it.
  // In both cases, we need to wait to finish initialization until the panel's
  // loaded into the XUL DOM.
  panel ? panelUtils.updateWindow() : panelUtils.create();
  panelUtils.whenPanelReady(() => { finishLaunch(opts); });
}

// TODO: worker sends over a ready signal. if it doesn't arrive, what do we do?
// TODO: why wouldn't a worker be cleanly shut down?
function finishLaunch(opts) {
  const panel = panelUtils.getPanel();

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
  let panelReloaded = false;
  // The add-on sometimes can't send a message to the worker, even after it
  // sends a first message. Try to ping the worker up to 10 times. If that
  // doesn't work, try to update the panel again.
  function pingWorker(tryCount) {
    if (tryCount > 10) {
      if (panelReloaded) return console.error('launchVideo failed after reloading panel');
      // Try reloading the panel a second time. Doing this manually seems to work.
      panelReloaded = true;
      panelUtils.updateWindow();
      panelUtils.whenPanelReady(() => { pingWorker(1) });
    }
    try {
      panel.port.emit('set-video', {domain: opts.domain, id: id, src: opts.src || ''});
      console.log('launchVideo successfully sent message to panel worker on try number ', tryCount);
    } catch (ex) {
      console.log('launchVideo caught a thrown error on try number ', tryCount);
      setTimeout(() => { pingWorker(++tryCount) }, 50);
    }
  }
  pingWorker(1);

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
