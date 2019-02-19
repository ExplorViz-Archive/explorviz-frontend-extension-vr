import Menu from '../menu';

let menu = null;
let prevMenu = null;

/**
 * Creates and opens the Connect Menu.
 */
export function open(lastMenu) {
  close.call(this);
  menu = Menu.create({
    name: 'advancedMenu'
  });
  
  menu.addTitle('Advanced Options');
  menu.addTextButton('Lefty Mode', 'lefty', {x: 100, y: 126}, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
  menu.addTextButton('Righty Mode', 'righty', {x: 100, y: 186}, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
  menu.addTextButton('Back', 'back', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);

  prevMenu = lastMenu;

  let controller = this.get('userIsLefty') ? this.get('controller2') : this.get('controller1'); 

  menu.interact = (action, position) => {
    let item = menu.getItem(position);
    if(item) {
      if(action === 'rightIntersect' || action === 'rightTriggerDown') {
        menu.setHover(item);
      }
      if(action === 'rightTriggerDown') {
        if(item.name === 'lefty') {
          close.call(this);
          this.switchToLeftyMode();
        } else if(item.name === 'righty') {
          close.call(this);
          this.switchToRightyMode();
        }else if(item.name === 'back') {
          back.call(this);
        }
      }
    } else {
      menu.setHover(null);
      menu.deactivateItems();
    }
  };
  menu.createMesh();
  menu.addToController(controller);
}

/**
 * Closes and removes the Advanced Menu.
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