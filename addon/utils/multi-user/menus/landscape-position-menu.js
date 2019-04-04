import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';
import BaseMenu from './menu-base';
import Menu from '../menu';

export default BaseMenu.extend({
  time: service(),
  
  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu, that) {
    this._super(lastMenu, that);

    this.set('menu', Menu.create(getOwner(that).ownerInjection(), { name: 'changeLandscapePositionMenu' }));

    this.get('menu').addTitle('Move Landscape');
  
    // buttons for moving landscape in plane
    this.get('menu').addRectangle({ x: 226, y: 246 }, 60, 60, '#eeeeee');
    this.get('menu').addArrowButton('move_left', { x: 160, y: 246 }, { x: 200, y: 306 }, 'arrow_left', '#ffc338');
    this.get('menu').addArrowButton('move_right', { x: 312, y: 246 }, { x: 352, y: 306 }, 'arrow_right', '#ffc338');
    this.get('menu').addArrowButton('move_forward', { x: 226, y: 180 }, { x: 286, y: 220 }, 'arrow_up', '#ffc338');
    this.get('menu').addArrowButton('move_backward', { x: 226, y: 332 }, { x: 286, y: 372 }, 'arrow_down', '#ffc338');
  
    // buttons for changing landscape height
    this.get('menu').addRectangle({ x: 70, y: 178 }, 60, 4, '#eeeeee');
    this.get('menu').addArrowButton('move_up', { x: 80, y: 120 }, { x: 120, y: 160 }, 'arrow_up', '#ffc338');
    this.get('menu').addArrowButton('move_down', { x: 80, y: 200 }, { x: 120, y: 240 }, 'arrow_down', '#ffc338');
  
    // buttons for rotating landscape
    this.get('menu').addCurvedArrowButton('rotate_right', { x: 390, y: 120 }, 60, 'curved_arrow_right', '#ffc338');
    this.get('menu').addCurvedArrowButton('rotate_left', { x: 390, y: 200 }, 60, 'curved_arrow_left', '#ffc338');
  
    // add back button
    this.get('menu').addTextButton('Back', 'back', { x: 100, y: 402 }, 316, 50, 28, '#555555', '#ffffff', '#929292', true);

    let triggerController = that.get('userIsLefty') ? that.get('controller1') : that.get('controller2');
    let menuController = that.get('userIsLefty') ? that.get('controller2') : that.get('controller1'); 
  
    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      if (item) {
        if (action === 'rightIntersect' || action === 'rightTriggerDown') {
          this.get('menu').setHover(item);
        }
        if (action === 'rightTriggerDown') {
          if (item.name === 'back') {
            this.back(that);
          } else {
            item.isActivated = true;
          }
        }
        if (action === 'rightTriggerPressed' && item.isActivated) {
          const triggerValue = triggerController.getTriggerValue();
  
          const moveAndRotateDistance = triggerValue * this.get('time').getDeltaTime();
  
          if (item.name === 'move_left') {
            that.moveLandscape({ x: -moveAndRotateDistance, y: 0, z: 0 });
          } else if (item.name === 'move_right') {
            that.moveLandscape({ x: moveAndRotateDistance, y: 0, z: 0 });
          } else if (item.name === 'move_forward') {
            that.moveLandscape({ x: 0, y: 0, z: -moveAndRotateDistance });
          } else if (item.name === 'move_backward') {
            that.moveLandscape({ x: 0, y: 0, z: moveAndRotateDistance });
          } else if (item.name === 'move_up') {
            that.moveLandscape({ x: 0, y: moveAndRotateDistance, z: 0 });
          } else if (item.name === 'move_down') {
            that.moveLandscape({ x: 0, y: -moveAndRotateDistance, z: 0 });
          } else if (item.name === 'rotate_left') {
            that.rotateLandscape({ x: -moveAndRotateDistance, y: 0, z: 0 });
          } else if (item.name === 'rotate_right') {
            that.rotateLandscape({ x: moveAndRotateDistance, y: 0, z: 0 });
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