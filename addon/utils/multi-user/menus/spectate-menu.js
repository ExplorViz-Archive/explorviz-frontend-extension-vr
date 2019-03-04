import BaseMenu from './menu-base';
import Menu from '../menu';
import { inject as service } from "@ember/service";

export default BaseMenu.extend({

  store: service(),
  spectating: service(), 

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
      let users = this.get('store').peekAll('vr-user').toArray();

      // Sort users by Id
      users.sort( (a,b) => (a.id > b.id) ? 1 : -1); 

      if (item) {
        if (action === 'rightIntersect' || action === 'rightTriggerDown') {
          this.get('menu').setHover(item);
        }
        if (action === 'rightTriggerDown') {
          if (item.name === 'next_user') {
            if (users.length < 1)
              return;

            if (!this.get('spectating.spectatedUser')) {
              this.get('spectating').activate(users[0].get('id'));
              this.get('menu').updateText('spectating_user', users[0].get('name'));
              return;
            }

            let spectatedUser = users.find( (user) => {return user.get('id') === this.get('spectating.spectatedUser')});
            let index = users.indexOf(spectatedUser);

            if (spectatedUser) {
              if (index === users.length - 1) {
                this.get('spectating').deactivate();
                this.get('menu').updateText('spectating_user', 'Spectating off');
              } else {
                this.get('spectating').activate(users[index + 1].get('id'));
                this.get('menu').updateText('spectating_user', users[index + 1].get('name'));
              }
            }
          } else if (item.name === 'previous_user') {
            if (users.length < 1)
              return;

            if (!that.get('spectating.spectatedUser')) {
              this.get('spectating').activate(users[users.length - 1]);
              this.get('menu').updateText('spectating_user', users[users.length - 1]).get('name');
              return;
            }

            let spectatedUser = users.find( (user) => {return user.get('id') === this.get('spectating.spectatedUser')});
            let index = users.indexOf(spectatedUser);

            if (index !== -1) {
              if (index === 0) {
                this.get('spectating').deactivate();
                this.get('menu').updateText('spectating_user', 'Spectating off');
              } else {
                this.get('spectating').activate(users[index - 1].get('id'));
                this.get('menu').updateText('spectating_user', users[index - 1].get('name'));
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
  close() {
    this._super(...arguments);
    this.get('spectating').deactivate();
  },

  /**
   * Changes the text of a text item and updates the mesh.
   * 
   * @param {string} itemName - The unique identifier of the item.
   * @param {string} text - The new text of the item.
   */
  updateText(itemName, text) {
    const menu = this.get('menu');

    if (menu)
      menu.updateText(itemName, text);
  }
});