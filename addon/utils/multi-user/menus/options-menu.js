import Menu from '../menu';
import SpectateMenu from './spectate-menu';
import LandscapePositionMenu from './landscape-position-menu';
import CameraHeightMenu from './camera-height-menu';

let menu = null;
let prevMenu = null;

export function open() {
  menu = new Menu({
      title: 'optionsMenu',
      resolution: { width: 256, height: 256 },
      size: { height: 0.3, width: 0.3},
      opacity: 0.8,
      color: '#444444',
  });
  menu.addText('Options', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
  menu.addText('Change Height', 'change_height', 14, { x: 128, y: 70}, '#ffc338', 'center', true);
  menu.addText('Change Landscape Position', 'change_landscape_position', 14, { x: 128, y: 100}, '#ffc338', 'center', true);
  menu.addText('Spectate', 'spectate', 14, { x: 128, y: 130}, '#ffc338', 'center', true);
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
        }
      }
    } else {
      menu.setHover(null);
    }
  };

  menu.createMesh();
  menu.mesh.position.x += 0.2;
  menu.mesh.geometry.rotateX(-1.5707963267949);
  this.controller1.add(menu.mesh);
  this.menus.set(menu.title, menu);
}

export function close() {
  if(menu) {
    this.controller1.remove(menu.mesh);
    menu.close();
    this.menus.delete(menu.title);
    menu = null;
  }
}

export function isOpen() {
  return menu ? true : false;
}

export function hasBackButton() {
  return prevMenu ? true : false;
}