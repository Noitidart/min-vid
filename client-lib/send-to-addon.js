module.exports = sendToAddon;

function sendToAddon(obj) {
  window.pendingCommand.push(JSON.stringify(obj));
}
