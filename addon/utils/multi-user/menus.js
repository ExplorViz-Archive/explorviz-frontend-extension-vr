import UserListMenu from './menus/user-list-menu';
import OptionsMenu from './menus/options-menu';
import SpectateMenu from './menus/spectate-menu';
import LandscapePositionMenu from './menus/landscape-position-menu';
import CameraHeightMenu from './menus/camera-height-menu';
import MessageBox from './menus/message-box-menu';
import ConnectMenu from './menus/connect-menu';
import HintMenu from './menus/hint-menu';

let menus = new Map();

export {
  UserListMenu,
  OptionsMenu,
  SpectateMenu,
  LandscapePositionMenu,
  CameraHeightMenu,
  MessageBox,
  ConnectMenu,
  HintMenu
}

/**
 * Returns an iterator of all open menus.
 */
export function getMenus() {
  return menus.values();
}

/**
 * Returns an array containing all menu meshes that are set visible.
 */
export function getVisibleMenuMeshesArray() {
  let list = [];
  for(let menu of menus.values()) {
    if(menu.mesh.visible && menu.mesh.parent.visible)
      list.push(menu.mesh);
  }
  return list;
}

/**
 * Returns menu object matching the name.
 * 
 * @param {string} menuName - The name of the menu.
 */
export function get(menuName) {
  return menus.get(menuName);
}

/**
 * Adds a menu to the opened list, which enables raycasting.
 * 
 * @param {object} menu - The menu to set as opened.
 */
export function add(menu) {
  menus.set(menu.get('name'), menu);
}

/**
 * Removes menu from the opened-menu list and disable raycasting on it.
 * 
 * @param {string} menuName - The name of the menu.
 */
export function remove(menuName) {
  menus.delete(menuName);
}