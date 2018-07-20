import EmberObject from '@ember/object';
import THREE from 'three';

/*global createOBJLoader*/

export default EmberObject.extend({
  name: null,
  id: null,
  device: null,
  state: null,
  controller1: {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    model: new THREE.Object3D()
  },
  controller2: {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    model: new THREE.Object3D()
  },
  camera: {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    model: new THREE.Object3D()
  },

  init() {
    const self = this;
    let OBJLoader = createOBJLoader(THREE);
    let loader = new OBJLoader(THREE.DefaultLoadingManager);
    if(this.device === "vive") {
      // Load VIVE Controller Model
      loader.setPath('vive-controller/');
      loader.load('vr_controller_vive_1_5.obj', function(object) {
        const obj = object;
        obj.name = "viveTexture";
        let loader = new THREE.TextureLoader();
        loader.setPath('vive-controller/');
        let controller = obj.children[0];
        controller.material.map = loader.load('onepointfive_texture.png');
        controller.material.specularMap = loader.load('onepointfive_spec.png');
        self.get('controller1.model').add(obj.clone());
        self.get('controller2.model').add(obj.clone());
      });
    }
    else if(this.device === "oculus") {
      // Load VIVE Controller Model
      loader.setPath('oculus_cv1_controller/');
      loader.load('oculus_cv1_controller_left.obj', function(object) {
        const obj = object;
        obj.name = "oculusTexture";
        let loader = new THREE.TextureLoader();
        loader.setPath('oculus_cv1_controller/');
        let controller = obj.children[0];
        controller.material.map = loader.load('external_controller01_col.png');
        controller.material.specularMap = loader.load('external_controller01_spec.png');
        self.get('controller1.model').add(obj.clone());
      });
      loader.load('oculus_cv1_controller_right.obj', function(object) {
        const obj = object;
        obj.name = "oculusTexture";
        let loader = new THREE.TextureLoader();
        loader.setPath('oculus_cv1_controller/');
        let controller = obj.children[0];
        controller.material.map = loader.load('external_controller01_col.png');
        controller.material.specularMap = loader.load('external_controller01_spec.png');
        self.get('controller2.model').add(obj.clone());
      });
    }
    // Load HMD Model
    loader.setPath('generic_hmd/');
    loader.load('generic_hmd.obj', function(object) {
      const obj = object;
      obj.name = "hmdTexture";
      let loader = new THREE.TextureLoader();
      loader.setPath('generic_hmd/');
      let controller = obj.children[0];
      controller.material.map = loader.load('generic_hmd.tga');
      self.get('camera.model').add(obj.clone());
    });
  },
  
  updateCamera(camera) {
    this.camera.position.fromArray(camera.position);
    this.camera.quaternion.fromArray(camera.quaternion);
    this.camera.model.position.copy(this.camera.position);
    this.camera.model.quaternion.copy(this.camera.quaternion);
  },
  
  updateControllers(controllers) {
    const { controller1, controller2 } = controllers;
    this.controller1.position.fromArray(controller1.position);
    this.controller1.quaternion.fromArray(controller1.quaternion);
    this.controller2.position.fromArray(controller2.position);
    this.controller2.quaternion.fromArray(controller2.quaternion);
    this.controller1.model.position.copy(this.controller1.position);
    this.controller1.model.quaternion.copy(this.controller1.quaternion);
    this.controller2.model.position.copy(this.controller2.position);
    this.controller2.model.quaternion.copy(this.controller2.quaternion);
  }
});