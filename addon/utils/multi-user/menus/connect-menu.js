import BaseMenu from './menu-base';
import Menu from '../menu';
import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';

export default BaseMenu.extend({
  
  user: service(),
  connection: service(),

  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu) {
    this._super(lastMenu);

    this.set('menu', Menu.create(getOwner(this).ownerInjection(), { name: 'connectMenu' }));
    
    this.get('menu').addTitle('Connection');
    this.get('menu').addText('Status: ', 'status', 28, { x: 256, y: 140}, '#ffffff', 'center', false);
    this.get('menu').addTextButton('', 'connect', {x: 100, y: 186}, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
    this.get('menu').addTextButton('Back', 'back', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
  
    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      
      let state = this.get('user.state');
      if(item) {
        if(action === 'rightIntersect' || action === 'rightTriggerDown') {
          this.get('menu').setHover(item);
        }
        if(action === 'rightTriggerDown') {
          if(item.name === 'connect') {
            if(state === 'offline') {
              this.get('connection').connect();
            }
            else if(state === 'connected') {
              this.get('connection').disconnect();
            }
          } else if(item.name === 'back') {
            this.back();
          }
        }
      } else {
        this.get('menu').setHover(null);
        this.get('menu').deactivateItems();
      }
    };
    this.get('menu').createMesh();
    let controller = this.get('user.secondaryController');
    this.get('menu').addToController(controller);
  
    this.setState(this.get('user.state'));
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
  },
  
  setState(state) {
    const menu = this.get('menu');
  
    if(!menu)
      return;
  
    if(state === 'offline') {
      menu.updateText('status', 'Status: offline');
      menu.updateText('connect', 'Connect');
      menu.setClickable('connect', true);
      menu.setColor('status', '#ff3a3a');
    } else if(state === 'connecting') {
      menu.updateText('status', 'Status: connecting');
      menu.updateText('connect', '...');
      menu.setClickable('connect', false);
      menu.setColor('status', '#ff9719');
    } else if(state === 'connected') {
      menu.updateText('status', 'Status: connected');
      menu.updateText('connect', 'Disconnect');
      menu.setClickable('connect', true);
      menu.setColor('status', '#3bba2a');
    }
  }
});