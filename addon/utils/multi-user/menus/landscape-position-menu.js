import Menu from '../menu';

let menu = null;
let prevMenu = null;

/**
 * Creates and opens the Landscape Position Menu.
 * 
 * @param {Object} lastMenu - The menu to go back to on back button pressed.
 */
export function open(lastMenu) {
  menu = new Menu({
    title: 'changeLandscapePositionMenu'
  });
  menu.addRectangle({x: 0, y: 0}, 256, 33, '#777777');
  menu.addText('Change Landscape Position', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);

  // buttons for moving landscape in plane
  menu.addRectangle({x: 113, y: 133}, 30, 30, '#eeeeee');
  menu.addArrowButton('move_left', {x: 80, y: 133}, {x: 100, y: 163}, 'arrow_left', '#ffc338');
  menu.addArrowButton('move_right', {x: 156, y: 133}, {x: 176, y: 163}, 'arrow_right', '#ffc338');
  menu.addArrowButton('move_forward', {x: 113, y: 100}, {x: 143, y: 120}, 'arrow_up', '#ffc338');
  menu.addArrowButton('move_backward', {x: 113, y: 176}, {x: 143, y: 196}, 'arrow_down', '#ffc338');

  // buttons for changing landscape height
  menu.addRectangle({x: 35, y: 89}, 30, 2, '#eeeeee');
  menu.addArrowButton('move_up', {x: 40, y: 60}, {x: 60, y: 80}, 'arrow_up', '#ffc338');
  menu.addArrowButton('move_down', {x: 40, y: 100}, {x: 60, y: 120}, 'arrow_down', '#ffc338');

  // buttons for rotating landscape
  menu.addCurvedArrowButton('rotate_right', {x: 195, y: 60}, 30, 'curved_arrow_right', '#ffc338');
  menu.addCurvedArrowButton('rotate_left', {x: 195, y: 100}, 30, 'curved_arrow_left', '#ffc338');

  // add back button
  menu.addText('Back', 'back', 14, { x: 128, y: 220}, '	#ffffff', 'center', true);
  prevMenu = lastMenu;
  menu.interact = (action, position) => {
    let item = menu.getItem(position);
    if(item) {
      if(action === 'rightIntersect') {
        menu.setHover(item);
      }
      if(action === 'rightTrigger') {
        if(item.name === 'move_left') {
          this.moveLandscape({x: -0.1, y: 0, z: 0});
        } else if(item.name === 'move_right') {
          this.moveLandscape({x: 0.1, y: 0, z: 0});
        } else if(item.name === 'move_forward') {
          this.moveLandscape({x: 0, y: 0, z: -0.1});
        } else if(item.name === 'move_backward') {
          this.moveLandscape({x: 0, y: 0, z: 0.1});
        } else if(item.name === 'move_up') {
          this.moveLandscape({x: 0, y: 0.1, z: 0});
        } else if(item.name === 'move_down') {
          this.moveLandscape({x: 0, y: -0.1, z: 0});
        } else if(item.name === 'rotate_left') {
          this.rotateLandscape({x: -0.05, y: 0, z: 0});
        } else if(item.name === 'rotate_right') {
          this.rotateLandscape({x: 0.05, y: 0, z: 0});
        } else if(item.name === 'back') {
          back.call(this);
        }
      }
    } else {
      menu.setHover(null);
    }
  };
  menu.createMesh();

  // move mesh next to controller 1 and add it as child.
  const mesh = menu.getMesh();
  mesh.position.x += 0.2;
  mesh.geometry.rotateX(-1.5707963267949);
  this.get('controller1').add(mesh);
}

/**
 * Closes and removes the Landscape Position Menu.
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
