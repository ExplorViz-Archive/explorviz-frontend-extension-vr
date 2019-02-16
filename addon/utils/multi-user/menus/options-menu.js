import Menu from '../menu';
import SpectateMenu from './spectate-menu';
import LandscapePositionMenu from './landscape-position-menu';
import CameraHeightMenu from './camera-height-menu';
import ConnectMenu from './connect-menu';

let menu = null;

/**
 * Creates and opens the Options Menu.
 */
export function open() {
  menu = Menu.create({
      name: 'optionsMenu'
  });
  menu.addTitle('Options');
  menu.addTextButton('Change Camera', 'change_height', {x: 100, y: 126}, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
  menu.addTextButton('Move Landscape', 'change_landscape_position', {x: 100, y: 186}, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
  menu.addTextButton('Spectate', 'spectate', {x: 100, y: 246}, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
  menu.addTextButton('Connection', 'connection', {x: 100, y: 306}, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
  menu.addTextButton('Exit', 'exit', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
  
  menu.interact = (action, position) => {
    let item = menu.getItem(position);
    if(item) {
      if(action === 'rightIntersect') {
        menu.setHover(item);
      }
      if(action === 'rightTrigger') {
        if(item.name === 'exit') {
          close.call(this);
        } else if(item.name === 'change_height') {
          close.call(this);
          CameraHeightMenu.open.call(this, open);
        } else if(item.name === 'change_landscape_position') {
          close.call(this);
          LandscapePositionMenu.open.call(this, open);
        } else if(item.name === 'spectate') {
          close.call(this);
          SpectateMenu.open.call(this, open);
        } else if(item.name === 'connection') {
          close.call(this);
          ConnectMenu.open.call(this, open);
        }
      }
    } else {
      menu.setHover(null);
    }
  };

  menu.createMesh();
  const mesh = menu.get('mesh');
  mesh.position.x += 0.2;
  mesh.geometry.rotateX(-1.5707963267949);
  this.get('controller1').add(mesh);

  // hide spectate menu item if user isn't connected the server
  if(this.state === 'offline' || this.state === 'connecting') {
    menu.setClickable('spectate', false);
    menu.setColor('spectate', '#A8A8A8');
  }
}

/**
 * Closes and removes the Options Menu.
 */
export function close() {
  if(menu) {
    this.get('controller1').remove(menu.get('mesh'));
    menu.close();
    menu = null;
  }
}

/**
 * Return whether the menu is opened or not.
 */
export function isOpen() {
  return menu ? true : false;
}