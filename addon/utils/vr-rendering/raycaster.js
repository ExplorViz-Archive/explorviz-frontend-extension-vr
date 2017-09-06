import Ember from 'ember';
import THREE from "npm:three";

export default Ember.Object.extend({

  raycaster: new THREE.Raycaster(),

  landscapeObjects: ['node', 'system', 'nodegroup', 'application', 'communication', 'label', 'floor'],
  applicationObjects: ['component', 'clazz', 'communication'],
  objectCatalog: 'landscapeObjects',
  objectCatalogApp: 'applicationObjects',

  raycasting(origin, direction, camera, possibleObjects) {

    const self = this;
    const raycaster = this.get('raycaster');

    if (camera) {
      // direction = mouse
      raycaster.setFromCamera(direction, camera);
    } else if (origin) {
      // vr-raycasting, e.g. ray origin is Vive controller
      raycaster.set(origin, direction);
    }

    // calculate objects intersecting the picking ray (true => recursive)
    const intersections = raycaster.intersectObjects(possibleObjects,
      false);
	  

    if (intersections.length > 0) {
		return intersections[0];
    }else{
		return;
	 }
  }
  
});
