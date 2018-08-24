import Menu from '../menu';
import THREE from 'three';

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
  menu.addText('Change Landscape Position', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);

  // buttons for moving landscape in plane
  menu.addArrowButton('move_left', {x: 70, y: 123}, {x: 90, y: 153}, 'arrow_left', '#ffc338');
  menu.addArrowButton('move_right', {x: 166, y: 123}, {x: 186, y: 153}, 'arrow_right', '#ffc338');
  menu.addArrowButton('move_forward', {x: 113, y: 80}, {x: 143, y: 100}, 'arrow_up', '#ffc338');
  menu.addArrowButton('move_backward', {x: 113, y: 176}, {x: 143, y: 196}, 'arrow_down', '#ffc338');

  // buttons for changing landscape height
  menu.addArrowButton('move_up', {x: 40, y: 60}, {x: 60, y: 80}, 'arrow_up', '#ffc338');
  menu.addArrowButton('move_down', {x: 40, y: 100}, {x: 60, y: 120}, 'arrow_down', '#ffc338');

    // buttons for rotating landscape
    menu.addArrowButton('rotate_left', {x: 195, y: 60}, {x: 215, y: 80}, 'arrow_right', '#ffc338');
    menu.addArrowButton('rotate_right', {x: 195, y: 100}, {x: 215, y: 120}, 'arrow_left', '#ffc338');

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
          this.moveLandscape({x: 20, y: 0});
        } else if(item.name === 'move_right') {
          this.moveLandscape({x: -20, y: 0});
        } else if(item.name === 'move_forward') {
          this.moveLandscape({x: 0, y: 20});
        } else if(item.name === 'move_backward') {
          this.moveLandscape({x: 0, y: -20});
        } else if(item.name === 'move_up') {
          this.changeLandscapeHeight(0.1);
        } else if(item.name === 'move_down') {
          this.changeLandscapeHeight(- 0.1);
        } else if(item.name === 'rotate_left') {
          this.get('vrEnvironment').rotation.x +=  0.05;
          this.updateObjectMatrix(this.get('vrEnvironment'));
          this.get('interaction').trigger('centerVREnvironment');
          this.get('interaction').trigger('landscapeMoved', new THREE.Vector3(0, 0, 0));
        } else if(item.name === 'rotate_right') {
          this.get('vrEnvironment').rotation.x -=  0.05;
          this.updateObjectMatrix(this.get('vrEnvironment'));
          this.get('interaction').trigger('centerVREnvironment');
          this.get('interaction').trigger('landscapeMoved', new THREE.Vector3(0, 0, 0));
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
  this.controller1.add(mesh);
}

/**
 * Closes and removes the Landscape Position Menu.
 */
export function close() {
  if(menu) {
    this.controller1.remove(menu.getMesh());
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
