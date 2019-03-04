import BaseMenu from './menu-base';
import Menu from '../menu';
import { getOwner } from '@ember/application';

export default BaseMenu.extend({
  
  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu, that) {
    this._super(lastMenu, that);

    this.set('menu', Menu.create(getOwner(that).ownerInjection(), { name: 'optionsMenu' }));

    this.get('menu').addTitle('Options');
    this.get('menu').addTextButton('Change Camera', 'change_height', { x: 100, y: 80 }, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
    this.get('menu').addTextButton('Move Landscape', 'change_landscape_position', { x: 100, y: 140 }, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
    this.get('menu').addTextButton('Spectate', 'spectate', { x: 100, y: 200 }, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
    this.get('menu').addTextButton('Connection', 'connection', { x: 100, y: 260 }, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
    this.get('menu').addTextButton('Advanced Options', 'advanced', { x: 100, y: 320 }, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
    this.get('menu').addTextButton('Exit', 'exit', { x: 100, y: 402 }, 316, 50, 28, '#555555', '#ffffff', '#929292', true);

    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      if (item) {
        if (action === 'rightIntersect' || action === 'rightTriggerDown') {
          this.get('menu').setHover(item);
        }
        if (action === 'rightTriggerDown') {
          if (item.name === 'exit') {
            this.close();
          } else if (item.name === 'change_height') {
            this.close();
            that.get('cameraHeightMenu').open(this, that);
          } else if (item.name === 'change_landscape_position') {
            this.close();
            that.get('landscapePositionMenu').open(this, that);
          } else if (item.name === 'spectate') {
            this.close();
            that.get('spectateMenu').open(this, that);
          } else if (item.name === 'connection') {
            this.close();
            that.get('connectMenu').open(this, that);
          } else if (item.name === 'advanced') {
            this.close();
            that.get('advancedMenu').open(this, that);
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
  
    // hide spectate menu item if user isn't connected the server
    if (that.get('user.state') === 'offline' || that.get('user.state') === 'connecting') {
      this.get('menu').setClickable('spectate', false);
      this.get('menu').setColor('spectate', '#A8A8A8');
    }
  }
});