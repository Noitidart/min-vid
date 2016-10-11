console.log('frame script loaded');

// Listen for messages from content and forward to chrome
addEventListener('addon-message', (evt) => {
  console.log('frame script forwarding content message to chrome');
  const type = evt.data.type;
  const args = evt.data.args;
  sendAsyncMessage('message', {
    type: type, args: args
  });
}

// Listen for messages from chrome and forward to content
addMessageListener('minvid-msg-from-chrome', (msg) => {
  const type = evt.data.type;
  const data = evt.data.data;
  console.log('frame script forwarding chrome message to content');
  const evt = new window.MessageEvent(type, { data: data });
  window.dispatchEvent(evt);
}
