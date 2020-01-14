import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';
import BaseMenu from './menu-base';
import Menu from '../menu';

export default BaseMenu.extend({
  time: service(),

  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu) {
    this._super(lastMenu);

    this.set('menu', Menu.create(getOwner(this).ownerInjection(), { name: 'changeCameraHeightMenu' }));
    
    this.get('menu').addTitle('Change Camera');
    this.get('menu').addArrowButton('height_down', {x: 100, y: 182}, {x: 150, y: 242}, 'arrow_down', '#ffc338');
    this.get('menu').addArrowButton('height_up', {x: 366, y: 182}, {x: 416, y: 242}, 'arrow_up', '#ffc338');
    this.get('menu').addText(this.get('user').getPosition().y.toFixed(2), 'camera_height', 28, { x: 256, y: 202}, '#ffffff', 'center', false);
    this.get('menu').addTextButton('Back', 'back', { x: 100, y: 402 }, 316, 50, 28, '#555555', '#ffffff', '#929292', true);

    this.get('menu').addTextButton('Reset', 'reset_camera', { x: 420, y: 13 }, 65, 40, 22, '#aaaaaa', '#ffffff', '#dc3b00', true);
  
    let triggerController = this.get('user.primaryController');
  
    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      if(item) {
        if(action === 'rightIntersect') {
          this.get('menu').setHover(item);
        }
        if(action === 'rightTriggerDown'){
          if(item.name === 'back') {
            this.back();
          } else if (item.name === 'reset_camera') {
            this.get('user').getPosition().y = 0;
            this.get('menu').updateText('camera_height', this.get('user').getPosition().y.toFixed(2));
          } else {
            item.isActivated = true;
          }
        }
        if(action === 'rightTriggerUp'){
          item.isActivated = false;
        }
        if(action === 'rightTriggerPressed' && item.isActivated) {
          const triggerValue = triggerController.getTriggerValue();
  
          const moveDistance = triggerValue * this.get('time').getDeltaTime();
  
          if(item.name === 'height_down') {
            this.get('user').getPosition().y -= moveDistance;
            this.get('menu').updateText('camera_height', this.get('user').getPosition().y.toFixed(2));
          } else if(item.name === 'height_up') {
            this.get('user').getPosition().y += moveDistance;
            this.get('menu').updateText('camera_height', this.get('user').getPosition().y.toFixed(2));
          }
        }
      } else {
        this.get('menu').setHover(null);
        this.get('menu').deactivateItems();
      }
    };
    
    this.get('menu').createMesh();
    this.addToSecondaryController();
  }
});
