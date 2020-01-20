import BaseMenu from './menu-base';
import Menu from '../menu';
import { getOwner } from '@ember/application';

export default BaseMenu.extend({

  world: service(),

  /**
   * Creates and opens the Reset Menu.
   */
  open(lastMenu) {
    this._super(lastMenu);

    this.set('menu', Menu.create(getOwner(this).ownerInjection(), { name: 'resetMenu' }));

    this.get('menu').addTitle('Reset');

    this.get('menu').addTextButton('Reset All', 'resetAll', { x: 100, y: 186 }, 316, 50, 28, '#555555', '#ffc338', '#929292', true);
    this.get('menu').addTextButton('Back', 'back', { x: 100, y: 402 }, 316, 50, 28, '#555555', '#ffffff', '#929292', true);

    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      if (item) {
        if (action === 'rightIntersect' || action === 'rightTriggerDown') {
          this.get('menu').setHover(item);
        }
        if (action === 'rightTriggerDown') {
          if (item.name === 'resetAll') {

            //TODO Reset Landscape position, reset user position, close applications, close system, unhighlight all entities
            this.get('user').resetPosition();
            this.get('world').resetLandscape();
            // this.get('world').closeAndUnhighlightAllEntities();

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
    this.addToSecondaryController();
  }
});
