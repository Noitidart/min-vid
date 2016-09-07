const { getActiveView } = require('sdk/view/core');

module.exports = makePanelDraggable;

// Makes an SDK panel draggable. Pass in an SDK panel.
function makePanelDraggable(sdkPanel) {
  // Remove the panel from the XUL DOM, make some attribute changes, then
  // reattach it. Reseating in the DOM triggers updates in the XBL bindings
  // that give the panel draggability and remove some SDK styling.
  const panel = getActiveView(sdkPanel);
  const frame = panel.getElementsByTagName('iframe')[0];
  const parent = panel.parentNode;

  parent.removeChild(panel);

  panel.setAttribute('noautohide', true);
  panel.setAttribute('backdrag', true);
  panel.setAttribute('style', '-moz-appearance: none; border: 0; margin: 0; padding:30px; background: brown');
  panel.removeAttribute('type');

  parent.appendChild(panel);
}
