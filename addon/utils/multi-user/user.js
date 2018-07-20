import EmberObject from '@ember/object';
import THREE from 'three';

export default EmberObject.extend({
  name: null,
  id: null,
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
    model: null
  },

  init() {
    const self = this;
    let geometry = new THREE.BoxGeometry( .1, .1, .1 );
    let material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
    let cameraModel = new THREE.Mesh( geometry, material );
    //let controllerModel1 = new THREE.Mesh( geometry, material );
    //let controllerModel2 = new THREE.Mesh( geometry, material );
    this.camera.model = cameraModel;
    //this.controller1.model = controllerModel1;
    //this.controller2.model = controllerModel2;
    // Load VIVE-Controller texture
    let OBJLoader = createOBJLoader(THREE);
    let loader = new OBJLoader(THREE.DefaultLoadingManager);
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
  },
  
  updateCamera() {
    this.camera.model.position.copy(this.camera.position);
    this.camera.model.quaternion.copy(this.camera.quaternion);
  },
  
  updateControllers() {
    this.controller1.model.position.copy(this.controller1.position);
    this.controller1.model.quaternion.copy(this.controller1.quaternion);
    this.controller2.model.position.copy(this.controller2.position);
    this.controller2.model.quaternion.copy(this.controller2.quaternion);
  }
});