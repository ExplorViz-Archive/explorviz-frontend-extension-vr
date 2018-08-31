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
  menu = new Menu({
      title: 'optionsMenu'
  });
  menu.addText('Options', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
  menu.addText('Change Height', 'change_height', 14, { x: 128, y: 70}, '#ffc338', 'center', true);
  menu.addText('Change Landscape Position', 'change_landscape_position', 14, { x: 128, y: 100}, '#ffc338', 'center', true);
  menu.addText('Spectate', 'spectate', 14, { x: 128, y: 130}, '#ffc338', 'center', true);
  menu.addText('Connection', 'connection', 14, { x: 128, y: 160}, '#ffc338', 'center', true);
  menu.addText('Exit', 'exit', 14, { x: 128, y: 220}, '	#ffffff', 'center', true);
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
  const mesh = menu.getMesh();
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
    this.get('controller1').remove(menu.getMesh());
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