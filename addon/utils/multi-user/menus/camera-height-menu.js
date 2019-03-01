import BaseMenu from './menu-base';
import Menu from '../menu';

export default BaseMenu.extend({
  
  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu, that) {
    this._super(lastMenu, that);

    this.set('menu', Menu.create({ name: 'changeCameraHeightMenu' }));
    
    this.get('menu').addTitle('Change Camera');
    this.get('menu').addArrowButton('height_down', {x: 100, y: 182}, {x: 150, y: 242}, 'arrow_down', '#ffc338');
    this.get('menu').addArrowButton('height_up', {x: 366, y: 182}, {x: 416, y: 242}, 'arrow_up', '#ffc338');
    this.get('menu').addText(that.get('user.position.y').toFixed(2), 'camera_height', 28, { x: 256, y: 202}, '#ffffff', 'center', false);
    this.get('menu').addTextButton('Back', 'back', {x: 100, y: 402}, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
  
    let triggerController = that.get('userIsLefty') ? that.get('controller1') : that.get('controller2');
    let menuController = that.get('userIsLefty') ? that.get('controller2') : that.get('controller1'); 
  
    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      if(item) {
        if(action === 'rightIntersect') {
          this.get('menu').setHover(item);
        }
        if(action === 'rightTriggerDown'){
          if(item.name === 'back') {
            this.back(that);
          } else {
            item.isActivated = true;
          }
        }
        if(action === 'rightTriggerUp'){
          item.isActivated = false;
        }
        if(action === 'rightTriggerPressed' && item.isActivated) {
          const deltaTime = that.get('deltaTime');
          const triggerValue = triggerController.getTriggerValue();
  
          const moveDistance = triggerValue * deltaTime;
  
          if(item.name === 'height_down') {
            that.get('user').position.y -= moveDistance;
            this.get('menu').updateText('camera_height', that.get('user').position.y.toFixed(2));
          } else if(item.name === 'height_up') {
            that.get('user').position.y += moveDistance;
            this.get('menu').updateText('camera_height', that.get('user').position.y.toFixed(2));
          }
        }
      } else {
        this.get('menu').setHover(null);
        this.get('menu').deactivateItems();
      }
    };
    
    this.get('menu').createMesh();
    this.get('menu').addToController(menuController);
  }
});