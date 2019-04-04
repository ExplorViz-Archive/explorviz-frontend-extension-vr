import Service from '@ember/service';

export default Service.extend({

  userID: null, // Own userID
  state: null, // Own connection status, state in {'connecting', 'connected', 'spectating'}
  color: null,
  controllersConnected: null, // Tells which controller(s) is/are connected
  threeGroup: null, // Contains camera and controller objects

  init() {
    this._super(...arguments)
    this.set('controllersConnected', { controller1: false, controller2: false });
    this.set('state', 'offline');
  },

  getPosition() {
    return this.get('threeGroup.position');
  },
  
  getCamera() {
    return this.get('threeGroup').getObjectByName('camera');
  },

  getController1() {
    return this.get('threeGroup').getObjectByName('controller1');
  },
  
  getController2() {
    return this.get('threeGroup').getObjectByName('controller2');
  },
  
});
