import Service, { inject as service } from '@ember/service';
import THREE from 'three';

export default Service.extend({

  userID: null, // Own userID
  state: null, // Own connection status, state in {'connecting', 'connected', 'spectating'}
  color: null,
  controllersConnected: null, // Tells which controller(s) is/are connected
  threeGroup: null, // Contains camera and controller objects
  isLefty: null,
  menus: service(),
  world: service(),

  init() {
    this._super(...arguments)
    this.set('controllersConnected', { controller1: false, controller2: false });
    this.set('state', 'offline');
    this.set('isLefty', false);
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

  switchHand() {
    this.get('menus').removeAll();
    let oldMenuController = this.get('isLefty') ? this.getController2() : this.getController1();
    let oldOtherController = this.get('isLefty') ? this.getController1() : this.getController2();
    if (oldMenuController.getObjectByName('textBox')) {
      oldMenuController.remove(oldMenuController.getObjectByName('textBox'));
    }
    this.toggleProperty('isLefty');
    this.get('world.interaction').removeControllerHandlers();
    this.set('world.interaction.primaryController', oldMenuController);
    this.set('world.interaction.secondaryController', oldOtherController);
    this.get('world.interaction').addControllerHandlers();
    oldMenuController.getObjectByName('controllerLine').material.color = new THREE.Color('rgb(0,204,51)');
    oldOtherController.getObjectByName('controllerLine').material.color = new THREE.Color('rgb(0,0,0)');
    this.get('menus.advancedMenu').open(this.get('menus.optionsMenu'));
  },
  
});
