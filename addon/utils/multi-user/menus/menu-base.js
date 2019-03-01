import EmberObject from '@ember/object';

export default EmberObject.extend({
  menu: null,
  prevMenu: null,
  
  /**
   * Creates and opens the Connect Menu.
   */
  open(lastMenu, that) {
    this.close(that);
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
  back(that) {
    this.close(that);
    if(this.get('prevMenu')) {
      this.get('prevMenu').open(null, that);
      this.set('prevMenu', null);
    }
  },
  
  /**
   * Return whether the menu is opened or not.
   */
  isOpen() {
    return this.get('menu') ? true : false;
  }
});