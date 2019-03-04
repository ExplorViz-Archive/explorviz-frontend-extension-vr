import Service from '@ember/service';
import { computed } from '@ember/object';

export default Service.extend({

  userID: null, // Own userID
  state: null, // Own connection status, state in {'connecting', 'connected', 'spectating'}
  color: null,
  controllersConnected: null, // Tells which controller(s) is/are connected
  threeGroup: null,
  position: computed('threeGroup.position', function() {
    return this.get('threeGroup.position');
  }),
  camera: computed(function() {
    return this.get('threeGroup').getObjectByName('camera');
  }),
  controller1: computed(function() {
    return this.get('threeGroup').getObjectByName('controller1');
  }),
  controller2: computed(function() {
    return this.get('threeGroup').getObjectByName('controller2');
  }),
  

  init() {
    this._super(...arguments)
    this.set('controllersConnected', { controller1: false, controller2: false });
    this.set('state', 'offline');
  }
  
});
