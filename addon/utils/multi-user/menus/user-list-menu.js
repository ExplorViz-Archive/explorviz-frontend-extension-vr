import Menu from '../menu';
import EmberObject from '@ember/object';
import Helper from '../helper';
import { inject as service } from "@ember/service";

export default EmberObject.extend({

  currentUser: service('user'),
  store: service(),
  session: service(),
  menu: null,
  
  /**
   * Creates and opens the User List Menu.
   */
  open() {
    this.close(); 
    this.set('menu', Menu.create({
      name: 'userListMenu',
      resolution: { width: 256, height: 256 }
    }));
  
    this.get('menu').addRectangle({x: 0, y: 0}, 256, 33, '#777777');
    this.get('menu').addText('Users', 'title', 18, { x: 20, y: 10}, '#ffffff', 'left', false);
  
    let users = this.get('store').peekAll('vr-user');
    let playingUsers = [];
    let spectatingUsers = [];
    users.forEach( (user) => {
      if(user.get('state') === 'connected') {
        playingUsers.push(user);
      } else if(user.get('state') === 'spectating') {
        spectatingUsers.push(user);
      }
    });
  
    this.get('menu').addText('Connected', 'connected', 14, { x: 40, y: 50}, '#ffffff', 'left', false);
  
    let yOffset = 20;
    let yPos = 50 + yOffset;
  
    if(this.get('currentUser.state') === 'connected') {
      this.get('menu').addText(this.get('session.data.authenticated.username') || "ID: " + this.get('currentUser.userID'), 'connected', 12,
        { x: 50, y: yPos}, Helper.rgbToHex(this.get('currentUser.color')), 'left', false);
      yPos += yOffset;
    }
  
  
    for(let i = 0; i < playingUsers.length; i++) {
      let userColor = playingUsers[i].color;
      this.get('menu').addText(playingUsers[i].name, 'connected', 12, { x: 50, y: yPos + i*yOffset}, Helper.rgbToHex(userColor), 'left', false);
    }
  
    yPos = yPos + yOffset*(playingUsers.length);
  
    this.get('menu').addText('Spectating', 'spectating', 14, { x: 40, y: yPos}, '#ffffff', 'left', false);
  
    yPos += yOffset;
  
    if(this.get('currentUser.state') === 'spectating') {
      this.get('menu').addText(this.get('session.data.authenticated.username') || "ID: " + this.get('currentUser.userID'), 'connected', 12,
        { x: 50, y: yPos}, Helper.rgbToHex(this.get('currentUser.color')), 'left', false);
      yPos += yOffset;
    }
    
    for(let i = 0; i < spectatingUsers.length; i++) {
      let userColor = spectatingUsers[i].color;
      this.get('menu').addText(spectatingUsers[i].name, 'spectating', 12, { x: 50, y: yPos + i*yOffset}, Helper.rgbToHex(userColor), 'left', false);
    }
    
    this.get('menu').interact = () => {};
  
    this.get('menu').createMesh();
    const mesh = this.get('menu.mesh');
    mesh.position.z -= 0.5;
    this.get('currentUser').getCamera().add(mesh);
  },

  /**
   * Closes and removes User List Menu in the middle of the screen.
   */
  close() {
    const menu = this.get('menu');
    if(menu) {
      this.get('currentUser').getCamera().remove(menu.get('mesh'));
      menu.close();
      this.set('menu', null);
    }
  }
});