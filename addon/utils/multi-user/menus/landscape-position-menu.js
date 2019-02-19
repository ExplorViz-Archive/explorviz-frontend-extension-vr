import Menu from '../menu';

let menu = null;
let prevMenu = null;

/**
 * Creates and opens the Landscape Position Menu.
 * 
 * @param {Object} lastMenu - The menu to go back to on back button pressed.
 */
export function open(lastMenu) {
  menu = Menu.create({
    name: 'changeLandscapePositionMenu'
  });

  menu.addTitle('Move Landscape');

  // buttons for moving landscape in plane
  menu.addRectangle({ x: 226, y: 246 }, 60, 60, '#eeeeee');
  menu.addArrowButton('move_left', { x: 160, y: 246 }, { x: 200, y: 306 }, 'arrow_left', '#ffc338');
  menu.addArrowButton('move_right', { x: 312, y: 246 }, { x: 352, y: 306 }, 'arrow_right', '#ffc338');
  menu.addArrowButton('move_forward', { x: 226, y: 180 }, { x: 286, y: 220 }, 'arrow_up', '#ffc338');
  menu.addArrowButton('move_backward', { x: 226, y: 332 }, { x: 286, y: 372 }, 'arrow_down', '#ffc338');

  // buttons for changing landscape height
  menu.addRectangle({ x: 70, y: 178 }, 60, 4, '#eeeeee');
  menu.addArrowButton('move_up', { x: 80, y: 120 }, { x: 120, y: 160 }, 'arrow_up', '#ffc338');
  menu.addArrowButton('move_down', { x: 80, y: 200 }, { x: 120, y: 240 }, 'arrow_down', '#ffc338');

  // buttons for rotating landscape
  menu.addCurvedArrowButton('rotate_right', { x: 390, y: 120 }, 60, 'curved_arrow_right', '#ffc338');
  menu.addCurvedArrowButton('rotate_left', { x: 390, y: 200 }, 60, 'curved_arrow_left', '#ffc338');

  // add back button
  menu.addTextButton('Back', 'back', { x: 100, y: 402 }, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
  prevMenu = lastMenu;

  let triggerController = this.get('userIsLefty') ? this.get('controller1') : this.get('controller2');
  let menuController = this.get('userIsLefty') ? this.get('controller2') : this.get('controller1'); 

  menu.interact = (action, position) => {
    let item = menu.getItem(position);
    if (item) {
      if (action === 'rightIntersect' || action === 'rightTriggerDown') {
        menu.setHover(item);
      }
      if (action === 'rightTriggerDown') {
        if (item.name === 'back') {
          back.call(this);
        } else {
          item.isActivated = true;
        }
      }
      if (action === 'rightTriggerPressed' && item.isActivated) {
        const deltaTime = this.get('deltaViewTime');
        const triggerValue = triggerController.getTriggerValue();

        const moveAndRotateDistance = triggerValue * deltaTime;

        if (item.name === 'move_left') {
          this.moveLandscape({ x: -moveAndRotateDistance, y: 0, z: 0 });
        } else if (item.name === 'move_right') {
          this.moveLandscape({ x: moveAndRotateDistance, y: 0, z: 0 });
        } else if (item.name === 'move_forward') {
          this.moveLandscape({ x: 0, y: 0, z: -moveAndRotateDistance });
        } else if (item.name === 'move_backward') {
          this.moveLandscape({ x: 0, y: 0, z: moveAndRotateDistance });
        } else if (item.name === 'move_up') {
          this.moveLandscape({ x: 0, y: moveAndRotateDistance, z: 0 });
        } else if (item.name === 'move_down') {
          this.moveLandscape({ x: 0, y: -moveAndRotateDistance, z: 0 });
        } else if (item.name === 'rotate_left') {
          this.rotateLandscape({ x: -moveAndRotateDistance, y: 0, z: 0 });
        } else if (item.name === 'rotate_right') {
          this.rotateLandscape({ x: moveAndRotateDistance, y: 0, z: 0 });
        }
      }
    } else {
      menu.setHover(null);
      menu.deactivateItems();
    }
  };
  menu.createMesh();

  menu.addToController(menuController);
}

/**
 * Closes and removes the Landscape Position Menu.
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
