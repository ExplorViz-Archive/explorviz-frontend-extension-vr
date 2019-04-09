import Service, { inject as service } from '@ember/service';

export default Service.extend({
  
  currentUser: service('user'),
  menus: service(),
  world: service(),
  store: service(),
  webSocket: service(),

  connect() {
    this.set('currentUser.state', 'connecting');
    this.get('webSocket').initSocket();
  },

  /**
   * Switch to offline mode, close socket connection
   */
  disconnect() {
    // Set own state to offline
    this.set('currentUser.state', 'offline');
    
    // Remove other users and their corresponding models and name tags
    let users = this.get('store').peekAll('vr-user');
    users.forEach( (user) => {
      this.get('world.scene').remove(user.get('controller1.model'));
      user.removeController1();
      this.get('world.scene').remove(user.get('controller2.model'));
      user.removeController2();
      this.get('world.scene').remove(user.get('camera.model'));
      user.removeCamera();
      this.get('world.scene').remove(user.get('namePlane'));
      user.removeNamePlane();
      this.get('store').unloadRecord(user);
    });

    // Close socket
    this.get('webSocket').closeSocket();
  },
});
