import BaseMenu from './menu-base';
import Menu from '../menu';
import { getOwner } from '@ember/application';

export default BaseMenu.extend({
  
  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu, that) {
    this._super(lastMenu, that);

    this.set('menu', Menu.create(getOwner(that).ownerInjection(), { name: 'advancedMenu' }));
    
    this.get('menu').addTitle('Advanced Options');
    this.get('menu').addText('Lefty Mode', 'isLeftyText', 28, { x: 100, y: 148 }, '#FFFFFF', 'left', false);
    this.get('menu').addCheckbox("isLefty", { x: 366, y: 126 }, 50, 50, '#ffc338', '#ffffff', '#00e5ff', true, that.get('userIsLefty'));
    this.get('menu').addTextButton('Back', 'back', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
  
    let controller = that.get('userIsLefty') ? that.get('controller2') : that.get('controller1'); 
  
    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      if(item) {
        if(action === 'rightIntersect' || action === 'rightTriggerDown') {
          this.get('menu').setHover(item);
        }
        if (action === 'rightTriggerDown') {
          if (item.name === 'isLefty') {
            this.close();
            that.switchHand();
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
    this.get('menu').addToController(controller);
  }
});