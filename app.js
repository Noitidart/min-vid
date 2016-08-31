const React = require('react');
const ReactDOM = require('react-dom');
const AppView = require('./components/app-view.js');

const defaultData = {
  id: 'L6_SbflSwAg',
  src: 'https://r6---sn-n4v7sn7z.googlevideo.com/videoplayback?id=eb3f36c3497a9301&itag=160&source=youtube&requiressl=yes&nh=IgpwcjAyLnNqYzA3KgkxMjcuMC4wLjE&initcwndbps=1041250&mm=31&mn=sn-n4v7sn7z&pl=33&ms=au&mv=m&ratebypass=yes&mime=video/mp4&gir=yes&clen=2094587&lmt=1429521893147744&dur=153.486&upn=id8vRp4-rIo&signature=4FC644F013909D945D8D1AF51115D230FE669E02.064E053A74ECC1960E89F80293467CF6B19C799E&key=dg_yt0&sver=3&mt=1472619916&ip=2601:642:c303:1810:4c53:872c:78e9:c7ad&ipbits=0&expire=1472641978&sparams=ip,ipbits,expire,id,itag,source,requiressl,nh,initcwndbps,mm,mn,pl,ms,mv,ratebypass,mime,gir,clen,lmt,dur',
  domain: 'youtube.com',
  minimized: false,
  loaded: false,
  error: false,
  muted: false,
  currentTime: '0:00 / 0:00',
  duration: 0,
  progress: 0.001, // force progress element to start out empty
  playing: false,
  playedCount: 0,
  volume: '0.5'
};

window.AppData = new Proxy(defaultData, {
  set: function(obj, prop, value) {
    obj[prop] = value;
    renderApp();
    return true;
  }
});

function renderApp() {
  ReactDOM.render(React.createElement(AppView, window.AppData),
                  document.getElementById('container'));
}
