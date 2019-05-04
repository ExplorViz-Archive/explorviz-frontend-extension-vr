import Service from '@ember/service';
import UserListMenu from '../utils/multi-user/menus/user-list-menu';
import OptionsMenu from '../utils/multi-user/menus/options-menu';
import SpectateMenu from '../utils/multi-user/menus/spectate-menu';
import LandscapePositionMenu from '../utils/multi-user/menus/landscape-position-menu';
import CameraHeightMenu from '../utils/multi-user/menus/camera-height-menu';
import MessageBox from '../utils/multi-user/menus/message-box-menu';
import ConnectMenu from '../utils/multi-user/menus/connect-menu';
import HintMenu from '../utils/multi-user/menus/hint-menu';
import AdvancedMenu from '../utils/multi-user/menus/advanced-menu';
import { getOwner } from '@ember/application';

export default Service.extend({

  menus: new Map(),

  createMenus() {
    this.set('advancedMenu', AdvancedMenu.create(getOwner(this).ownerInjection()));
    this.set('connectMenu', ConnectMenu.create(getOwner(this).ownerInjection()));
    this.set('cameraHeightMenu', CameraHeightMenu.create(getOwner(this).ownerInjection()));
    this.set('landscapePositionMenu', LandscapePositionMenu.create(getOwner(this).ownerInjection()));
    this.set('spectateMenu', SpectateMenu.create(getOwner(this).ownerInjection()));
    this.set('userListMenu', UserListMenu.create(getOwner(this).ownerInjection()));
    this.set('hintMenu', HintMenu.create(getOwner(this).ownerInjection()));
    this.set('messageBox', MessageBox.create(getOwner(this).ownerInjection()));
    this.set('optionsMenu', OptionsMenu.create(getOwner(this).ownerInjection()));
  },


  /**
   * Returns an iterator of all open menus.
   */
  getMenus() {
    return this.get('menus').values();
  },

  /**
   * Returns an array containing all menu meshes that are set visible.
   */
  getVisibleMenuMeshesArray() {
    let list = [];
    for (let menu of this.get('menus').values()) {
      if (menu.mesh.visible && menu.mesh.parent.visible)
        list.push(menu.mesh);
    }
    return list;
  },

  /**
   * Returns menu object matching the name.
   * 
   * @param {string} menuName - The name of the menu.
   */
  getMenuByName(menuName) {
    return this.get('menus').get(menuName);
  },

  /**
   * Adds a menu to the opened list, which enables raycasting.
   * 
   * @param {object} menu - The menu to set as opened.
   */
  add(menu) {
    this.get('menus').set(menu.get('name'), menu);
  },

  /**
   * Removes menu from the opened-menu list and disable raycasting on it.
   * 
   * @param {string} menuName - The name of the menu.
   */
  remove(menuName) {
    this.get('menus').delete(menuName);
  },


  removeAll() {
    this.get('menus').clear();
  },
});

