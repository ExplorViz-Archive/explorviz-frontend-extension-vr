import EmberObject from '@ember/object';
import THREE from "three";

/*
 * This util is used to calculate the objects hit by the controller 
 * (raycaster).
 */
export default EmberObject.extend({

  raycaster: new THREE.Raycaster(),

  // Calculate intersected object
  raycasting(origin, direction, camera, possibleObjects) {

    const raycaster = this.get('raycaster');

    if (camera) {
      // direction = mouse
      raycaster.setFromCamera(direction, camera);
    } else if (origin) {
      // vr-raycasting, e.g. ray origin is Vive controller
      raycaster.set(origin, direction);
    }

    // calculate objects intersecting the picking ray (true => recursive)
    const intersections = raycaster.intersectObjects(possibleObjects, false);

    // Return content
    if (intersections.length > 0) {
        return intersections[0];
    }
    else{
        return;
    }
  }
  
});
