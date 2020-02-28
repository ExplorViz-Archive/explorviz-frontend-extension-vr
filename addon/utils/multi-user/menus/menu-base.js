import EmberObject from '@ember/object';
import { inject as service } from '@ember/service';

export default EmberObject.extend({
  
  user: service(),

  menu: null,
  prevMenu: null,
  
  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu) {
    this.close();
    this.set('prevMenu', lastMenu);
  },
  
  /**
   * Closes and removes the Advanced Menu.
   */
  close() {
    const menu = this.get('menu');
    if(menu) {
      menu.get('mesh').parent.remove(menu.get('mesh'));
      menu.close();
      this.set('menu', null);
    }
  },
  
  /**
   * Go back to the previous menu.
   */
  back() {
    this.close();
    if(this.get('prevMenu')) {
      this.get('prevMenu').open(null);
      this.set('prevMenu', null);
    }
  },
  
  /**
   * Return whether the menu is opened or not.
   */
  isOpen() {
    return this.get('menu') ? true : false;
  },
  
  /**
   * Adds the mesh of the menu to the secondary controller
   */
  addToSecondaryController() {
    this.get('menu').addToController(this.get('user.secondaryController'));
  },

  addToPrimaryController() {
    this.get('menu').addToController(this.get('user.primaryController'));
  }
});