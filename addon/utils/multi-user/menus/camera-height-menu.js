import Menu from '../menu';

let menu = null;
let prevMenu = null;

/**
 * Creates and opens the Camera Height Menu.
 * 
 * @param {Object} lastMenu - The menu to go back to on back button pressed.
 */
export function open(lastMenu) {
  menu = new Menu({
    name: 'changeCameraHeightMenu'
  });
  menu.addTitle('Change Camera');
  menu.addArrowButton('height_down', {x: 100, y: 182}, {x: 150, y: 242}, 'arrow_down', '#ffc338');
  menu.addArrowButton('height_up', {x: 366, y: 182}, {x: 416, y: 242}, 'arrow_up', '#ffc338');
  menu.addText(this.user.position.y.toFixed(2), 'camera_height', 28, { x: 256, y: 202}, '#ffffff', 'center', false);
  menu.addTextButton('Back', 'back', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
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
