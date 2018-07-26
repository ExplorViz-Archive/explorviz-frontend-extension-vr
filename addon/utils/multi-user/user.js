import EmberObject from '@ember/object';
import THREE from 'three';

/*global createOBJLoader*/

export default EmberObject.extend({
  name: null,
  id: null,
  state: null,
  controller1: {
    id: null,
    position: null,
    quaternion: null,
    model: null
  },
  controller2: {
    id: null,
    position: null,
    quaternion: null,
    model: null
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

  initController1(name) {
    console.log("init c1");
    const self = this;
    let OBJLoader = createOBJLoader(THREE);
    let loader = new OBJLoader(THREE.DefaultLoadingManager);

    this.controller1.id = name;
    this.controller1.position = new THREE.Vector3();
    this.controller1.quaternion = new THREE.Quaternion();
    this.controller1.model = new THREE.Object3D();

    if(name === 'Oculus Touch (Left)') {
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
    } else {
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
      });
    }
  },

  initController2(name) {
    const self = this;
    let OBJLoader = createOBJLoader(THREE);
    let loader = new OBJLoader(THREE.DefaultLoadingManager);

    this.controller2.id = name;
    this.controller2.position = new THREE.Vector3();
    this.controller2.quaternion = new THREE.Quaternion();
    this.controller2.model = new THREE.Object3D();

    if(name === 'Oculus Touch (Right)') {
      loader.setPath('oculus_cv1_controller/');
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
    } else {
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
        self.get('controller2.model').add(obj.clone());
      });
    }
  },

  removeController1() {
    this.controller1.id = null;
    this.controller1.position = null;
    this.controller1.quaternion = null;
    this.controller1.model = null;
  },

  removeController2() {
    this.controller2.id = null;
    this.controller2.position = null;
    this.controller2.quaternion = null;
    this.controller2.model = null;
  },

  removeCamera() {
    this.camera.position = null;
    this.camera.quaternion = null;
    this.camera.model = null;
  },
  
  updateCamera(camera) {
    this.camera.position.fromArray(camera.position);
    this.camera.quaternion.fromArray(camera.quaternion);
    this.camera.model.position.copy(this.camera.position);
    this.camera.model.quaternion.copy(this.camera.quaternion);
  },
  
  updateController1(controller) {
    this.controller1.position.fromArray(controller.position);
    this.controller1.quaternion.fromArray(controller.quaternion);
    this.controller1.model.position.copy(this.controller1.position);
    this.controller1.model.quaternion.copy(this.controller1.quaternion);
  },
  
  updateController2(controller) {
    this.controller2.position.fromArray(controller.position);
    this.controller2.quaternion.fromArray(controller.quaternion);
    this.controller2.model.position.copy(this.controller2.position);
    this.controller2.model.quaternion.copy(this.controller2.quaternion);
  }
});