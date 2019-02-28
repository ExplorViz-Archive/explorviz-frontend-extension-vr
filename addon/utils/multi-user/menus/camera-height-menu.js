import Menu from '../menu';

let menu = null;
let prevMenu = null;

/**
 * Creates and opens the Camera Height Menu.
 * 
 * @param {Object} lastMenu - The menu to go back to on back button pressed.
 */
export function open(lastMenu) {
  menu = Menu.create({
    name: 'changeCameraHeightMenu'
  });

  menu.addTitle('Change Camera');
  menu.addArrowButton('height_down', {x: 100, y: 182}, {x: 150, y: 242}, 'arrow_down', '#ffc338');
  menu.addArrowButton('height_up', {x: 366, y: 182}, {x: 416, y: 242}, 'arrow_up', '#ffc338');
  menu.addText(this.user.position.y.toFixed(2), 'camera_height', 28, { x: 256, y: 202}, '#ffffff', 'center', false);
  menu.addTextButton('Back', 'back', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
  prevMenu = lastMenu;

  let triggerController = this.get('userIsLefty') ? this.get('controller1') : this.get('controller2');
  let menuController = this.get('userIsLefty') ? this.get('controller2') : this.get('controller1'); 

  menu.interact = (action, position) => {
    let item = menu.getItem(position);
    if(item) {
      if(action === 'rightIntersect') {
        menu.setHover(item);
      }
      if(action === 'rightTriggerDown'){
        if(item.name === 'back') {
          back.call(this);
        } else {
          item.isActivated = true;
        }
      }
      if(action === 'rightTriggerUp'){
        item.isActivated = false;
      }
      if(action === 'rightTriggerPressed' && item.isActivated) {
        const deltaTime = this.get('deltaTime');
        const triggerValue = triggerController.getTriggerValue();

        const moveDistance = triggerValue * deltaTime;

        if(item.name === 'height_down') {
          this.get('user').position.y -= moveDistance;
          menu.updateText('camera_height', this.get('user').position.y.toFixed(2));
        } else if(item.name === 'height_up') {
          this.get('user').position.y += moveDistance;
          menu.updateText('camera_height', this.get('user').position.y.toFixed(2));
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
 * Closes and removes the Camera Height Menu.
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
