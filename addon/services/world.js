import Service, { inject as service } from '@ember/service';
import THREE from 'three';
import Evented from '@ember/object/evented';

export default Service.extend( Evented, {

  sender: service(),
  scene: null, // Root element of Object3d's - contains all visble objects
  interaction: null, //Class which handles mouse/keyboard/controller interaction
  vrEnvironment: null, // Contains vrLandscape and vrCommunications
  environmentOffset : null, // Tells how much the environment position should differ from the floor center point

  /* 
   *  This function is used to center the landscape(3D) on the floor.
   *  The object3D which contains the landscape(3D) and communication
   *  is centered relative to the floor.
   */

  reset() {
    this.set('scene', null);
    this.set('interaction', null);
    this.set('vrEnvironment', null);
    this.set('environmentOffset', null);
  },

  centerVREnvironment() {
    const floor = this.get('scene').getObjectByName('room');
    const vrEnvironment = this.get('vrEnvironment');

    // Compute bounding box of the floor
    const bboxFloor = new THREE.Box3().setFromObject(floor);

    // Calculate center of the floor 
    const centerFloor = new THREE.Vector3();
    bboxFloor.getCenter(centerFloor);

    // Compute bounding box of the vrEnvironment
    const bboxLandscape = new THREE.Box3().setFromObject(vrEnvironment);

    // Calculate center of the landscape(3D) (vrEnvironment) 
    const centerLandscape = new THREE.Vector3();
    bboxLandscape.getCenter(centerLandscape);

    // Set new position of vrEnvironment
    vrEnvironment.position.x += centerFloor.x - centerLandscape.x + this.get('environmentOffset.x');
    vrEnvironment.position.z += centerFloor.z - centerLandscape.z + this.get('environmentOffset.z');


    // Check distance between floor and landscape
    if (bboxLandscape.min.y > bboxFloor.max.y) {
      vrEnvironment.position.y += bboxFloor.max.y - bboxLandscape.min.y + 0.001;
    }

    // Check if landscape is underneath the floor
    if (bboxLandscape.min.y < bboxFloor.min.y) {
      vrEnvironment.position.y += bboxFloor.max.y - bboxLandscape.min.y + 0.001;
    }

    vrEnvironment.position.y += this.get('environmentOffset.y');
  },

  resetLandscape() {
    // Reset landscape position
    let delta = this.get('environmentOffset').clone();
    delta.multiplyScalar(-1);

    this.get('environmentOffset').x += delta.x;
    this.get('environmentOffset').y += delta.y;
    this.get('environmentOffset').z += delta.z;

    this.get('vrEnvironment').position.x += delta.x;
    this.get('vrEnvironment').position.y += delta.y;
    this.get('vrEnvironment').position.z += delta.z;

    this.get('vrEnvironment').rotation.x =  -1.5708;

    this.get('vrEnvironment').updateMatrix();
    this.centerVREnvironment();
    this.get('vrEnvironment').updateMatrix();

    this.get('sender').sendLandscapeUpdate(delta, this.get('vrEnvironment'), this.get('environmentOffset'));
  },

  resetAll() {
    this.trigger('resetAll');
  }
  
 

});
