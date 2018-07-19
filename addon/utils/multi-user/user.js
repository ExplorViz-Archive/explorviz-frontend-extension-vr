import EmberObject from '@ember/object';
import THREE from 'three';

export default EmberObject.extend({
  name: null,
  id: null,
  controllers: null,
  camera: null,
  mesh: null,

  init() {
    let geometry = new THREE.BoxGeometry( .1, .1, .1 );
    let material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
    let cube = new THREE.Mesh( geometry, material );
    this.set('mesh', cube);
  },
  
  setPosition(vector3) {
    this.camera = vector3;
    this.mesh.position.x = vector3.x;
    this.mesh.position.y = vector3.y;
    this.mesh.position.z = vector3.z;
  }
});