// Listen for messages from content and forward to chrome
addEventListener('minvid-msg', (evt) => {
  sendAsyncMessage('message', {
    type: evt.data.type, args: evt.data.args
  });
}

// Listen for messages from chrome and forward to content
addMessageListener('minvid-msg-from-chrome', (msg) => {
  const evt = new window.MessageEvent(msg.data.type, { data: msg.data.data });
  window.dispatchEvent(evt);
}
