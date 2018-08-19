import EmberObject from '@ember/object';
import THREE from 'three';

export default EmberObject.extend({
  label: null,
  name: null,
  id: null,
  state: null,
  highlightedEntity: {
    appID : null,
    entityID: null,
    originalColor : null
  },
  controller1: null,
  controller2: null,
  camera: null,
  color: null, // [r,g,b], r,g,b = 0,...,255
  namePlane: null, //PlaneGeometry containing username

  initCamera(obj) {
    this.camera = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      model: new THREE.Object3D()
    };
    this.get('camera.model').add(obj);
  },

  initController1(name, obj) {
    this.controller1 = {
      id: name,
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      model: new THREE.Object3D()
    };

    this.get('controller1.model').add(obj);
  },

  initController2(name, obj) {
    this.controller2 = {
      id: name,
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      model: new THREE.Object3D()
    };

    this.get('controller2.model').add(obj);
  },

  removeController1() {
    this.controller1 = null;
  },

  removeController2() {
    this.controller2 = null;
  },

  removeCamera() {
    this.camera = null;
  },

  removeNamePlane() {
    this.namePlane = null;
  },
  
  updateCamera(camera) {
    if(this.camera) {
      this.camera.position.fromArray([camera.position[0], camera.position[1] - 0.01, camera.position[2]]);
      this.camera.quaternion.fromArray(camera.quaternion);
      this.camera.model.position.copy(this.camera.position);
      this.camera.model.quaternion.copy(this.camera.quaternion);
    }
  },
  
  updateController1(controller) {
    if(this.controller1) {
      this.controller1.position.fromArray(controller.position);
      this.controller1.quaternion.fromArray(controller.quaternion);
      this.controller1.model.position.copy(this.controller1.position);
      this.controller1.model.quaternion.copy(this.controller1.quaternion);
    }
  },
  
  updateController2(controller) {
    if(this.controller2) {
      this.controller2.position.fromArray(controller.position);
      this.controller2.quaternion.fromArray(controller.quaternion);
      this.controller2.model.position.copy(this.controller2.position);
      this.controller2.model.quaternion.copy(this.controller2.quaternion);
    }
  },

  setHighlightedEntity(appID, entityID, originalColor){
    this.highlightedEntity.appID = appID;
    this.highlightedEntity.entityID = entityID;
    this.highlightedEntity.originalColor = originalColor;
  },

  setVisible(bool){
    if(this.camera) {
      this.camera.model.visible = bool;
    }
    if(this.controller1) {
      this.controller1.model.visible = bool;
    }
    if(this.controller2) {
      this.controller2.model.visible = bool;
    }
    if(this.namePlane) {
      this.namePlane.visible = bool;
    }
  }

});