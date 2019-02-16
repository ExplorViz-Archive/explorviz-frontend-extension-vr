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
  menu = Menu.create({
    name: 'spectateMenu'
  });

  menu.addTitle('Spectate');
  menu.addRectangle({x: 106, y: 182}, 304, 60, '#666666');
  menu.addArrowButton('previous_user', {x: 60, y: 182}, {x: 100, y: 242}, 'arrow_left', '#ffc338');
  menu.addArrowButton('next_user', {x: 416, y: 182}, {x: 456, y: 242}, 'arrow_right', '#ffc338');
  menu.addText('Spectating off', 'spectating_user', 28, { x: 256, y: 202}, '#ffffff', 'center', false);
  menu.addTextButton('Back', 'back', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
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

          // get all user that are connected
          let users = this.get('users').keys();
          let userArray = [];
          for(let id of users) {
            if(this.get('users').get(id).state === 'connected')
              userArray.push(id);
          }

          if(userArray.length < 1)
            return;

          // sort them by id
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
  const mesh = menu.get('mesh');
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
    this.get('controller1').remove(menu.get('mesh'));
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
