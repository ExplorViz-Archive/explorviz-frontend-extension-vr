import Menu from '../menu';

let menu = null;
let prevMenu = null;

/**
 * Creates and opens the Connect Menu.
 */
export function open(lastMenu) {
  close.call(this);
  menu = Menu.create({
    name: 'connectMenu'
  });
  
  menu.addTitle('Connection');
  menu.addText('Status: ', 'status', 28, { x: 256, y: 140}, '#ffffff', 'center', false);
  menu.addTextButton('', 'connect', {x: 100, y: 186}, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
  menu.addTextButton('Back', 'back', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);

  prevMenu = lastMenu;

  menu.interact = (action, position) => {
    let item = menu.getItem(position);
    if(item) {
      if(action === 'rightIntersect' || action === 'rightTriggerDown') {
        menu.setHover(item);
      }
      if(action === 'rightTriggerDown') {
        if(item.name === 'connect') {
          if(this.state === 'offline')
            this.connect();
          else if(this.state === 'connected')
            this.disconnect();
        } else if(item.name === 'back') {
          back.call(this);
        }
      }
    } else {
      menu.setHover(null);
      menu.deactivateItems();
    }
  };
  menu.createMesh();
  let controller = this.get('userIsLefty') ? 'controller2' : 'controller1'; 
  menu.addToController(this.get(controller));

  setState(this.state);
}

/**
 * Closes and removes the Camera Height Menu.
 */
export function close() {
  if(menu) {
    let controller = this.get('userIsLefty') ? this.get('controller2') : this.get('controller1'); 
    controller.remove(menu.get('mesh'));
    menu.close();
    menu = null;
  }
}

/**
 * Go back to the previous menu.
 */
export function back() {
  close.call(this);
  if(prevMenu) {
    prevMenu.call(this);
    prevMenu = null;
  }
}

/**
 * Return whether the menu is opened or not.
 */
export function isOpen() {
  return menu ? true : false;
}

/**
 * Changes the text of a text item and updates the mesh.
 * 
 * @param {string} itemName - The unique identifier of the item.
 * @param {string} text - The new text of the item.
 */
export function updateText(itemName, text) {
  if(menu)
    menu.updateText(itemName, text);
}

export function setState(state) {
  if(!menu)
    return;

  if(state === 'offline') {
    menu.updateText('status', 'Status: offline');
    menu.updateText('connect', 'Connect');
    menu.setClickable('connect', true);
    menu.setColor('status', '#ff3a3a');
  } else if(state === 'connecting') {
    menu.updateText('status', 'Status: connecting');
    menu.updateText('connect', '...');
    menu.setClickable('connect', false);
    menu.setColor('status', '#ff9719');
  } else if(state === 'connected') {
    menu.updateText('status', 'Status: connected');
    menu.updateText('connect', 'Disconnect');
    menu.setClickable('connect', true);
    menu.setColor('status', '#3bba2a');
  }
}