import BaseMenu from './menu-base';
import Menu from '../menu';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';

export default BaseMenu.extend({
  user: service(),
  menus: service(),

  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu) {
    this._super(lastMenu);

    this.set('menu', Menu.create(getOwner(this).ownerInjection(), { name: 'optionsMenu' }));

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
            this.get('menus.cameraHeightMenu').open(this);
          } else if (item.name === 'change_landscape_position') {
            this.close();
            this.get('menus.landscapePositionMenu').open(this);
          } else if (item.name === 'spectate') {
            this.close();
            this.get('menus.spectateMenu').open(this);
          } else if (item.name === 'connection') {
            this.close();
            this.get('menus.connectMenu').open(this);
          } else if (item.name === 'advanced') {
            this.close();
            this.get('menus.advancedMenu').open(this);
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
  
    // hide spectate menu item if user isn't connected the server
    if (this.get('user.state') === 'offline' || this.get('user.state') === 'connecting') {
      this.get('menu').setClickable('spectate', false);
      this.get('menu').setColor('spectate', '#A8A8A8');
    }
  }
});