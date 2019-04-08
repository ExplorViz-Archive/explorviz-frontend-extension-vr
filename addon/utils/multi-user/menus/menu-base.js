import EmberObject from '@ember/object';

export default EmberObject.extend({
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
  }
});