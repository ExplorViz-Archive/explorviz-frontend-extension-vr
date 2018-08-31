import Menu from '../menu';
import Helper from '../helper';

let menu = null;

/**
 * Creates and opens the User List Menu.
 */
export function open() {
  close.call(this); 
  menu = new Menu({
    title: 'userListMenu',
    resolution: { width: 256, height: 256 }
  });

  menu.addRectangle({x: 0, y: 0}, 256, 33, '#777777');
  menu.addText('Users', 'title', 18, { x: 20, y: 20}, '#ffffff', 'left', false);

  let users = this.get('users').values();
  let playingUsers = [];
  let spectatingUsers = [];
  for(let user of users) {
    if(user.state === 'connected') {
      playingUsers.push(user);
    } else if(user.state === 'spectating') {
      spectatingUsers.push(user);
    }
  }

  menu.addText('Connected', 'connected', 14, { x: 40, y: 50}, '#ffffff', 'left', false);

  let yOffset = 20;
  let yPos = 50 + yOffset;

  if(this.get('state') === 'connected') {
    menu.addText(this.get('session.data.authenticated.username') || "ID: " + this.get('userID'), 'connected', 12,
      { x: 50, y: yPos}, Helper.rgbToHex(this.get('color')), 'left', false);
    yPos += yOffset;
  }


  for(let i = 0; i < playingUsers.length; i++) {
    let userColor = playingUsers[i].color;
    menu.addText(playingUsers[i].name, 'connected', 12, { x: 50, y: yPos + i*yOffset}, Helper.rgbToHex(userColor), 'left', false);
  }

  yPos = yPos + yOffset*(playingUsers.length);

  menu.addText('Spectating', 'spectating', 14, { x: 40, y: yPos}, '#ffffff', 'left', false);

  yPos += yOffset;

  if(this.get('state') === 'spectating') {
    menu.addText(this.get('session.data.authenticated.username') || "ID: " + this.userID, 'connected', 12,
      { x: 50, y: yPos}, Helper.rgbToHex(this.get('color')), 'left', false);
    yPos += yOffset;
  }
  
  for(let i = 0; i < spectatingUsers.length; i++) {
    let userColor = spectatingUsers[i].color;
    menu.addText(spectatingUsers[i].name, 'spectating', 12, { x: 50, y: yPos + i*yOffset}, Helper.rgbToHex(userColor), 'left', false);
  }

  menu.interact = (action, position) => {};

  menu.createMesh();
  const mesh = menu.getMesh();
  mesh.position.z -= 0.5;
  this.get('camera').add(mesh);
}

/**
 * Closes and removes User List Menu in the middle of the screen.
 */
export function close() {
  if(menu) {
    this.get('camera').remove(menu.getMesh());
    menu.close();
    menu = null;
  }
}