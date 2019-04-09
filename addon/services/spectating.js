import Service, { inject as service } from '@ember/service';
import THREE from 'three';

export default Service.extend({

  currentUser: service('user'),
  sender: service(),
  store: service(),

  spectatedUser: null, // Tells which userID (if any) is being spectated
  startPosition: null, // Position before this user starts spectating

  /**
  * Used in spectating mode to set user's camera position to the spectated user's position
  */
  update() {
    let spectatedUser = this.get('store').peekRecord('vr-user', this.get('spectatedUser'));

    if (!spectatedUser) {
      this.deactivate();
      return;
    }

    let position = spectatedUser.get('camera.position');

    const cameraOffset = new THREE.Vector3();

    cameraOffset.copy(this.get('currentUser.camera.position'));
    this.get('currentUser').getPosition().subVectors(new THREE.Vector3(position.x, position.y, position.z), cameraOffset);
  },

  /**
 * Switches our user into spectator mode
 * @param {number} userID The id of the user to be spectated
 */
  activate(userID) {
    if (!userID) {
      return;
    }

    if (this.get('user.state') === 'spectating') {
      this.deactivate();
    }

    let spectatedUser = this.get('store').peekRecord('vr-user', userID);

    if (!spectatedUser) {
      return;
    }
    this.set('startPosition', this.get('currentUser').getPosition().clone());
    this.set('spectatedUser', userID);

    // Other user's hmd should be invisible
    spectatedUser.set('camera.model.visible', false);
    spectatedUser.set('namePlane.visible', false);
    this.set('currentUser.state', 'spectating');
    this.get('sender').sendSpectatingUpdate(this.get('currentUser.userID'), this.get('currentUser.state'), this.get('spectatedUser'));
  },

  /**
   * Deactives spectator mode for our user
   */
  deactivate() {
    if (!this.get('spectatedUser')) {
      return;
    }

    let spectatedUser = this.get('store').peekRecord('vr-user', this.get('spectatedUser'));

    if (!this.spectatedUser)
      return;

    spectatedUser.set('camera.model.visible', true);
    spectatedUser.set('namePlane.visible', true);
    this.set('currentUser.state', 'connected');
    // this.get('connectMenu').setState('connected');
    this.set('spectatedUser', null);

    // this.get('spectateMenu').updateText('spectating_user', 'Spectating off');

    let position = this.get('startPosition');
    this.get('currentUser').getPosition().fromArray(position.toArray());

    this.get('sender').sendSpectatingUpdate(this.get('currentUser.userID'), this.get('currentUser.state') /* , null */);
  },


});
