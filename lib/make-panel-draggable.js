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
//  panel.setAttribute('style', '-moz-appearance: none; border: 0; margin: 0; padding:30px; background: rgba(0,0,0,0)');
// what if we just show the background? we could selectively enable on hover.
  panel.setAttribute('style', '-moz-appearance: none; border: 0; margin: 0; padding:30px; background: brown');
  panel.removeAttribute('type');

  // Next, we need a XUL document to create a drag handle. There may be better
  // ways to obtain the document element, but this works:
  let doc = parent;
  while (doc !== null && doc.nodeType !== 9) {
    doc = doc.parentNode;
  }

  const dragHandle = doc.createElement('label');
  dragHandle.id = 'backdragspot';
  dragHandle.setAttribute('value', 'XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX');
  dragHandle.setAttribute('style', 'width:340px; height:200px; background: #2b2b2b; border: 1px solid black; color: #d5d5d5; cursor: grab');
  dragHandle.setAttribute('hidden', true);
  dragHandle.onmousedown = () => { dragHandle.style.cursor = 'grabbing' }
  dragHandle.onmouseup = () => { dragHandle.style.cursor = 'grab' }
  panel.appendChild(dragHandle);

  // make the drag handle only visible on mouseover
  panel.onmouseenter = (e) => {
    dragHandle.setAttribute('hidden', false);
    e.stopImmediatePropagation();
  };
  panel.onmouseleave = (e) => {
    dragHandle.setAttribute('hidden', true);
    e.stopImmediatePropagation();
  };
  // just while debugging, try canceling the other mouse events
  panel.onmouseover = (e) => { e.stopImmediatePropagation(); }

  // <stack> is the XUL way of permitting elements to be vertically offset:
  // position:absolute isn't available (apparently). The offset elements must
  // be children of the stack. We want the DOM to look like this:
  // <panel> (the SDK panel)
  //   <stack>
  //     <label> (the drag handle)
  //     <iframe> (the SDK panel contents iframe)
  //   </stack>
  // </panel>

  // 320 = width of player
  // what if we made the drag handle the background that appears under the video?
  // then you'd see this nice border with a grab hand. that seems super convenient.
  dragHandle.setAttribute('left', 0);
  dragHandle.setAttribute('top', 0);
  dragHandle.setAttribute('right', 340);
  dragHandle.setAttribute('bottom', 200);

  frame.setAttribute('left', 10);
  frame.setAttribute('top', 10);

  const stack = doc.createElement('stack');
  stack.appendChild(dragHandle);
  stack.appendChild(frame);
  panel.appendChild(stack);
  parent.appendChild(panel);
}
