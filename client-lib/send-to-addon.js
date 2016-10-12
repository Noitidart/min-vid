module.exports = sendToAddon;

function sendToAddon(obj) {
  throw new Error('sendToAddon: ', obj);
  // TODO: overwrites if multiple commands issued. should work fine.
  window.pendingCommand = JSON.stringify(obj);
}
