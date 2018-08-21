import Menu from '../menu';

let menu = null;
let prevMenu = null;

export function open(lastMenu) {
  menu = new Menu({
    title: 'changeCameraHeightMenu',
    resolution: { width: 256, height: 256 },
    size: { height: 0.3, width: 0.3},
    opacity: 0.8,
    color: '#444444',
  });
  menu.addText('Change Height', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
  menu.addArrowButton('height_down', {x: 30, y: 103}, {x: 60, y: 133}, 'arrow_down', '#ffc338');
  menu.addArrowButton('height_up', {x: 196, y: 103}, {x: 226, y: 133}, 'arrow_up', '#ffc338');
  menu.addText(this.user.position.y.toFixed(2), 'camera_height', 14, { x: 128, y: 113}, '#ffffff', 'center', false);
  menu.addText('Back', 'back', 14, { x: 128, y: 220}, '	#ffffff', 'center', true);
  prevMenu = lastMenu;
  menu.interact = (action, position) => {
    let item = menu.getItem(position);
    if(item) {
      if(action === 'rightIntersect') {
        menu.setHover(item);
      }
      if(action === 'rightTrigger') {
        if(item.name === 'height_down') {
          this.get('user').position.y -= 0.05;
          menu.updateText('camera_height', this.get('user').position.y.toFixed(2));
        } else if(item.name === 'height_up') {
          this.get('user').position.y += 0.05;
          menu.updateText('camera_height', this.get('user').position.y.toFixed(2));
        } else if(item.name === 'back') {
          back.call(this, lastMenu);
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

export function back() {
  close.call(this);
  if(prevMenu)
    prevMenu.call(this);
}

export function isOpen() {
  return menu ? true : false;
}

export function hasBackButton() {
  return prevMenu ? true : false;
}