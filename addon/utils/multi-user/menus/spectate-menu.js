import Menu from '../menu';
import Helper from '../helper';

let menu = null;
let prevMenu = null;

/**
 * Creates and opens the Spectate Menu.
 * 
 * @param {Object} lastMenu - The menu to go back to on back button pressed.
 */
export function open(lastMenu) {
  close.call(this);
  menu = new Menu({
    title: 'spectateMenu'
  });
  menu.addText('Spectate', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
  menu.addArrowButton('previous_user', {x: 30, y: 103}, {x: 50, y: 133}, 'arrow_left', '#ffc338');
  menu.addArrowButton('next_user', {x: 206, y: 103}, {x: 226, y: 133}, 'arrow_right', '#ffc338');
  menu.addText('Spectating off', 'spectating_user', 14, { x: 128, y: 113}, '#ffffff', 'center', false);
  menu.addText('Go Back and Stop Spectating', 'back', 14, { x: 128, y: 220}, '#ffffff', 'center', true);
  prevMenu = lastMenu;
  menu.interact = (action, position) => {
    let item = menu.getItem(position);
    if(item) {
      if(action === 'rightIntersect') {
        menu.setHover(item);
      }
      if(action === 'rightTrigger') {
        if(item.name === 'next_user') {
          if(this.get('users').size < 1)
            return;

          let users = this.get('users').keys();
          let userArray = [];

          for(let id of users) {
            if(this.get('users').get(id).state === 'connected')
              userArray.push(id);
          }

          if(userArray.length < 1)
            return;

          userArray.sort();

          if(!this.get('spectatedUser')) {
            this.activateSpectating(userArray[0]);
            menu.updateText('spectating_user', this.get('users').get(userArray[0]).name);
            return;
          }
          
          let index = Helper.binaryIndexOf(userArray, this.get('spectatedUser'));

          if(index !== -1) {
            if(index === userArray.length - 1) {
              this.deactivateSpectating();
              menu.updateText('spectating_user', 'Spectating off');
            } else {
              this.activateSpectating(userArray[index+1]);
              menu.updateText('spectating_user', this.get('users').get(userArray[index+1]).name);
            }
          }
        } else if(item.name === 'previous_user') {
          if(this.get('users').size < 1)
            return;

          let users = this.get('users').keys();
          let userArray = [];
          
          for(let id of users) {
            if(this.get('users').get(id).state === 'connected')
              userArray.push(id);
          }

          if(userArray.length < 1)
            return;

          userArray.sort();

          if(!this.get('spectatedUser')) {
            this.activateSpectating(userArray[userArray.length-1]);
            menu.updateText('spectating_user', this.get('users').get(userArray[userArray.length-1]).name);
            return;
          }
        
          let index = Helper.binaryIndexOf(userArray, this.get('spectatedUser'));

          if(index !== -1) {
            if(index === 0) {
              this.deactivateSpectating();
              menu.updateText('spectating_user', 'Spectating off');
            } else {
              this.activateSpectating(userArray[index-1]);
              menu.updateText('spectating_user', this.get('users').get(userArray[index-1]).name);
            }
          }
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
 * Closes and removes the Spectate Menu.
 */
export function close() {
  if(menu) {
    this.deactivateSpectating();
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

/**
 * Changes the text of a text item and updates the mesh.
 * 
 * @param {string} itemName - The unique identifier of the item.
 * @param {string} text - The new text of the item.
 */
export function updateText(itemName, text) {
  if(menu)
    menu.updateText(itemName, text);
}
