import UserListMenu from './menus/user-list-menu';
import OptionsMenu from './menus/options-menu';
import SpectateMenu from './menus/spectate-menu';
import LandscapePositionMenu from './menus/landscape-position-menu';
import CameraHeightMenu from './menus/camera-height-menu';
import MessageBox from './menus/message-box-menu';

let menus = new Map();

export {
  UserListMenu,
  OptionsMenu,
  SpectateMenu,
  LandscapePositionMenu,
  CameraHeightMenu,
  MessageBox
}

export function getMenus() {
  return menus.values();
}

export function getMenuMeshesArray() {
  let list = [];
  for(let menu of menus.values()) {
    list.push(menu.mesh);
  }
  return list;
}

export function get(menuTitle) {
  return menus.get(menuTitle);
}

export function add(menu) {
  menus.set(menu.getTitle(), menu);
};

export function remove(menuTitle) {
  menus.delete(menuTitle);
}