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
  panel.setAttribute('style', '-moz-appearance: none; border: 0; margin: 0; background: rgba(0,0,0,0)');
  panel.removeAttribute('type');

  // Next, we need a XUL document to create a drag handle. There may be better
  // ways to obtain the document element, but this works:
  let doc = parent;
  while (doc !== null && doc.nodeType !== 9) {
    doc = doc.parentNode;
  }

  const dragHandle = doc.createElement('label');
  dragHandle.id = 'backdragspot';
  dragHandle.setAttribute('value', 'click here to drag the thing');
  dragHandle.setAttribute('style', 'background: #2b2b2b; border: 1px solid black; color: #d5d5d5; cursor: grab');
  dragHandle.setAttribute('hidden', true);
  dragHandle.onmousedown = () => { dragHandle.style.cursor = 'grabbing' }
  dragHandle.onmouseup = () => { dragHandle.style.cursor = 'grab' }
  panel.appendChild(dragHandle);

  // make the drag handle only visible on mouseover
  panel.onmouseenter = () => { dragHandle.setAttribute('hidden', false) };
  panel.onmouseleave = () => { dragHandle.setAttribute('hidden', true) };

  // <stack> is the XUL way of permitting elements to be offset--there's no
  // position:absolute available (apparently). The offset elements must be
  // children of the stack. We want the DOM to look like this:
  // <panel> (the SDK panel)
  //   <stack>
  //     <label> (the drag handle)
  //     <iframe> (the SDK panel contents iframe)
  //   </stack>
  // </panel>

  const stack = doc.createElement('stack');
  stack.appendChild(dragHandle);
  stack.appendChild(frame);
  panel.appendChild(stack);
  parent.appendChild(panel);
}
