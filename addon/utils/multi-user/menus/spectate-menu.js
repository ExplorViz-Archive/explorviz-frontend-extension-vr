import BaseMenu from './menu-base';
import Menu from '../menu';
import Helper from '../helper';

export default BaseMenu.extend({
  
  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu, that) {
    this._super(lastMenu, that);

    this.set('menu', Menu.create({ name: 'spectateMenu' }));

    this.get('menu').addTitle('Spectate');
    this.get('menu').addRectangle({ x: 106, y: 182 }, 304, 60, '#666666');
    this.get('menu').addArrowButton('previous_user', { x: 60, y: 182 }, { x: 100, y: 242 }, 'arrow_left', '#ffc338');
    this.get('menu').addArrowButton('next_user', { x: 416, y: 182 }, { x: 456, y: 242 }, 'arrow_right', '#ffc338');
    this.get('menu').addText('Spectating off', 'spectating_user', 28, { x: 256, y: 202 }, '#ffffff', 'center', false);
    this.get('menu').addTextButton('Back', 'back', { x: 100, y: 402 }, 316, 50, 28, '#555555', '#ffffff', '#929292', true);

    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      if (item) {
        if (action === 'rightIntersect' || action === 'rightTriggerDown') {
          this.get('menu').setHover(item);
        }
        if (action === 'rightTriggerDown') {
          if (item.name === 'next_user') {
            if (that.get('users').size < 1)
              return;
  
            // get all user that are connected
            let users = that.get('users').keys();
            let userArray = [];
            for (let id of users) {
              if (that.get('users').get(id).state === 'connected')
                userArray.push(id);
            }
  
            if (userArray.length < 1)
              return;
  
            // sort them by id
            userArray.sort();
  
            if (!that.get('spectatedUser')) {
              that.activateSpectating(userArray[0]);
              this.get('menu').updateText('spectating_user', that.get('users').get(userArray[0]).name);
              return;
            }
  
            let index = Helper.binaryIndexOf(userArray, that.get('spectatedUser'));
  
            if (index !== -1) {
              if (index === userArray.length - 1) {
                that.deactivateSpectating();
                this.get('menu').updateText('spectating_user', 'Spectating off');
              } else {
                that.activateSpectating(userArray[index + 1]);
                this.get('menu').updateText('spectating_user', that.get('users').get(userArray[index + 1]).name);
              }
            }
          } else if (item.name === 'previous_user') {
            if (that.get('users').size < 1)
              return;
  
            let users = that.get('users').keys();
            let userArray = [];
  
            for (let id of users) {
              if (that.get('users').get(id).state === 'connected')
                userArray.push(id);
            }
  
            if (userArray.length < 1)
              return;
  
            userArray.sort();
  
            if (!that.get('spectatedUser')) {
              that.activateSpectating(userArray[userArray.length - 1]);
              this.get('menu').updateText('spectating_user', that.get('users').get(userArray[userArray.length - 1]).name);
              return;
            }
  
            let index = Helper.binaryIndexOf(userArray, that.get('spectatedUser'));
  
            if (index !== -1) {
              if (index === 0) {
                that.deactivateSpectating();
                this.get('menu').updateText('spectating_user', 'Spectating off');
              } else {
                that.activateSpectating(userArray[index - 1]);
                this.get('menu').updateText('spectating_user', that.get('users').get(userArray[index - 1]).name);
              }
            }
          } else if (item.name === 'back') {
            this.back(that);
          }
        }
      } else {
        this.get('menu').setHover(null);
        this.get('menu').deactivateItems();
      }
    };
    this.get('menu').createMesh();
    let controller = that.get('userIsLefty') ? 'controller2' : 'controller1'; 
    this.get('menu').addToController(that.get(controller));
  },

  /**
   * Closes and removes the Spectate Menu.
   */
  close(that) {
    this._super(...arguments);
    that.deactivateSpectating();
  },

  /**
   * Changes the text of a text item and updates the mesh.
   * 
   * @param {string} itemName - The unique identifier of the item.
   * @param {string} text - The new text of the item.
   */
  updateText(itemName, text) {
    const menu = this.get('menu');

    if(menu)
      menu.updateText(itemName, text);
  }
});