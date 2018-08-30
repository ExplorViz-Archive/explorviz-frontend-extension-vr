import Menu from '../menu';

let menu = null;
let prevMenu = null;

/**
 * Creates and opens the Connect Menu.
 */
export function open(lastMenu) {
  close.call(this);
  menu = new Menu({
    title: 'connectMenu'
  });
  menu.addText('Connection', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
  menu.addText('Status: ', 'status', 14, { x: 128, y: 40}, '#ffffff', 'center', false);
  menu.addText('', 'connect', 14, { x: 128, y: 113}, '#ffffff', 'center', true);
  menu.addText('Back', 'back', 14, { x: 128, y: 220}, '	#ffffff', 'center', true);
  prevMenu = lastMenu;

  menu.interact = (action, position) => {
    let item = menu.getItem(position);
    if(item) {
      if(action === 'rightIntersect') {
        menu.setHover(item);
      }
      if(action === 'rightTrigger') {
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
    }
  };
  menu.createMesh();
  const mesh = menu.getMesh();
  mesh.position.x += 0.2;
  mesh.geometry.rotateX(-1.5707963267949);
  this.get('controller1').add(mesh);

  setState(this.state);
}

/**
 * Closes and removes the Camera Height Menu.
 */
export function close() {
  if(menu) {
    this.get('controller1').remove(menu.getMesh());
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
  } else if(state === 'connecting') {
    menu.updateText('status', 'Status: connecting');
    menu.updateText('connect', '...');
    menu.setClickable('connect', false);
  } else if(state === 'connected') {
    menu.updateText('status', 'Status: connected');
    menu.updateText('connect', 'Disconnect');
    menu.setClickable('connect', true);
  }
}