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
    title: 'changeCameraHeightMenu'
  });
  menu.addRectangle({x: 0, y: 0}, 256, 33, '#777777');
  menu.addText('Change Camera', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
  menu.addArrowButton('height_down', {x: 30, y: 103}, {x: 60, y: 133}, 'arrow_down', '#ffc338');
  menu.addArrowButton('height_up', {x: 196, y: 103}, {x: 226, y: 133}, 'arrow_up', '#ffc338');
  menu.addText(this.user.position.y.toFixed(2), 'camera_height', 14, { x: 128, y: 113}, '#ffffff', 'center', false);
  menu.addText('Back', 'back', 14, { x: 128, y: 220}, ' #ffffff', 'center', true);
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
