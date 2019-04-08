import BaseMenu from './menu-base';
import Menu from '../menu';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';

export default BaseMenu.extend({
  
  currentUser: service('user'),
  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu) {
    this._super(lastMenu);

    this.set('menu', Menu.create(getOwner(this).ownerInjection(), { name: 'advancedMenu' }));
    
    this.get('menu').addTitle('Advanced Options');
    this.get('menu').addText('Lefty Mode', 'isLeftyText', 28, { x: 100, y: 148 }, '#FFFFFF', 'left', false);
    this.get('menu').addCheckbox("isLefty", { x: 366, y: 126 }, 50, 50, '#ffc338', '#ffffff', '#00e5ff', true, this.get('currentUser.isLefty'));
    this.get('menu').addTextButton('Back', 'back', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
  
    let controller = this.get('currentUser.isLefty') ? this.get('currentUser').getController2() : this.get('currentUser').getController1(); 
  
    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      if(item) {
        if(action === 'rightIntersect' || action === 'rightTriggerDown') {
          this.get('menu').setHover(item);
        }
        if (action === 'rightTriggerDown') {
          if (item.name === 'isLefty') {
            this.close();
            this.get('currentUser').switchHand();
          } else if (item.name === 'back') {
            this.back();
          }
        }
      } else {
        this.get('menu').setHover(null);
        this.get('menu').deactivateItems();
      }
    };
    this.get('menu').createMesh();
    this.get('menu').addToController(controller);
  }
});