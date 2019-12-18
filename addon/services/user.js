import Service, { inject as service } from '@ember/service';
import { computed } from '@ember/object';
import THREE from 'three';

export default Service.extend({

  menus: service(),
  world: service(),

  userID: null, // Own userID
  state: null, // Own connection status, state in {'connecting', 'connected', 'spectating'}
  color: null,
  controllersConnected: null, // Tells which controller(s) is/are connected
  camera: null, // PerspectiveCamera
  controller1: null, // Secondary controller
  controller2: null, // Primary controller
  threeGroup: null, // Contains camera and controller objects
  isLefty: null,

  primaryController: computed('isLefty', 'controller1', 'controller2', function() {
    return this.get('isLefty') ? this.get('controller1') : this.get('controller2');
  }),

  secondaryController: computed('isLefty', 'controller1', 'controller2', function() {
    return this.get('isLefty') ? this.get('controller2') : this.get('controller1');
  }),

  reset() {
    this.set('userID', null);
    this.set('state', null);
    this.set('color', null);
    this.set('controllersConnected', { controller1: false, controller2: false });
    this.set('camera', null);
    this.set('controller1', null);
    this.set('controller2', null);
    this.set('threeGroup', null);
    this.set('isLefty', false);
  },

  getPosition() {
    return this.get('threeGroup.position');
  },

  switchHand() {
    this.get('menus').removeAll();
    let oldMenuController = this.get('primaryController');
    let oldOtherController = this.get('secondaryController');
    if (oldMenuController.getObjectByName('textBox')) {
      oldMenuController.remove(oldMenuController.getObjectByName('textBox'));
    }
    this.get('world.interaction').removeControllerHandlers();
    this.toggleProperty('isLefty');
    this.get('world.interaction').addControllerHandlers();
    oldMenuController.getObjectByName('controllerLine').material.color = new THREE.Color('rgb(0,204,51)');
    oldOtherController.getObjectByName('controllerLine').material.color = new THREE.Color('rgb(0,0,0)');
    this.get('menus.advancedMenu').open(this.get('menus.optionsMenu'));
  },

  /*
   *  This method is used to adapt the users view to 
   *  the new position
   */
  teleportToPosition(position) {
    const cameraOffset = new THREE.Vector3();

    cameraOffset.copy(this.get('camera.position'));
    cameraOffset.y = 0;
    
    this.get('threeGroup.position').subVectors(new THREE.Vector3(position.x, this.get('threeGroup.position.y'), position.z), cameraOffset);
  },
  
});
