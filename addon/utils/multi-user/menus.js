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

export function getMenus() {
  return menus.values();
}

export function getVisibleMenuMeshesArray() {
  let list = [];
  for(let menu of menus.values()) {
    if(menu.mesh.visible && menu.mesh.parent.visible)
      list.push(menu.mesh);
  }
  return list;
}

export function get(menuTitle) {
  return menus.get(menuTitle);
}

export function add(menu) {
  menus.set(menu.getTitle(), menu);
}

export function remove(menuTitle) {
  menus.delete(menuTitle);
}