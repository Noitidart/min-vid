module.exports = sendToAddon;

function sendToAddon(obj) {
  // TODO: use an array instead of a string. we can access array/object types
  //       across the window barrier.
  window.pendingCommand = JSON.stringify(obj);
}
