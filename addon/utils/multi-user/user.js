import EmberObject from '@ember/object';
import THREE from 'three';

export default EmberObject.extend({
  label: null,
  name: null,
  id: null,
  state: null,
  controller1: null,
  controller2: null,
  camera: null,
  color: null,

  initCamera(obj) {
    this.camera = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      model: new THREE.Object3D()
    };
    let hsl = new Object();
    obj.children[0].material.emissive.setRGB(this.color[0]/255.0,this.color[1]/255.0,this.color[2]/255.0);
    obj.children[0].material.emissive.getHSL(hsl);
    obj.children[0].material.emissive.setHSL(hsl.h, hsl.s, 0.1);
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
  
  updateCamera(camera) {
    if(this.camera) {
      this.camera.position.fromArray(camera.position);
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
  }
});