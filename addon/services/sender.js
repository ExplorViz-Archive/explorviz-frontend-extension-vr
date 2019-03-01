import Service, { inject as service } from '@ember/service';
import THREE from 'three';

export default Service.extend({

  webSocket: service(),

  /**
   * Send update of position + quaternion of the
   * landscape (vrEnvironment)
   */
  sendLandscapeUpdate(deltaPosition, vrEnvironment, environmentOffset){
    let quaternion =  vrEnvironment.quaternion;

    let landscapeObj = {
      "event": "receive_landscape_position",
      "time": Date.now(),
      "deltaPosition" : deltaPosition.toArray(),
      "offset" : environmentOffset.toArray(),
      "quaternion" : quaternion.toArray()
    }
    this.get('webSocket').enqueueIfOpen(landscapeObj);
  },

  /**
   * Send the backend the information that a system was
   * closed or opened by this user
   * @param {Long} id ID of system which was opened/closed
   * @param {boolean} isOpen State of the system
   */
  sendSystemUpdate(id, isOpen){
    let systemObj = {
      "event": "receive_system_update",
      "time": Date.now(),
      "id": id,
      "isOpen": isOpen
    }
    this.get('webSocket').enqueueIfOpen(systemObj);
  },

  /**
   * Send the backend the information that a nodegroup was
   * closed or opened by this user
   * @param {Long} id ID of nodegroup which was opened/closed
   * @param {boolean} isOpen State of the nodegroup
   */
  sendNodegroupUpdate(id, isOpen){
    let nodeGroupObj = {
      "event": "receive_nodegroup_update",
      "time": Date.now(),
      "id": id,
      "isOpen": isOpen
    }
    this.get('webSocket').enqueueIfOpen(nodeGroupObj);
  },

  /**
   * Inform the backend that an application was closed
   * by this user
   * @param {Long} appID ID of the closed application
   */
  sendAppClosed(appID){
    let appObj = {
      "event": "receive_app_closed",
      "time": Date.now(),
      "id": appID
    }
    this.get('webSocket').enqueueIfOpen(appObj);
  },

  /**
   * Informs the backend that this user holds/moves an application
   * @param {Long} appID ID of the bound app
   * @param {Vector3} appPosition Position of the app (x, y, z)
   * @param {Quaternion} appQuaternion Quaternion of the app (x, y, z, w)
   * @param {boolean} isBoundToController1 Tells if app is hold by left controller
   * @param {Vector3} controllerPosition Position of the controller which holds the application
   * @param {Quaternion} controllerQuaternion Quaternion of the controller which holds the application
   */
  sendAppBinded(appID, appPosition, appQuaternion, isBoundToController1, controllerPosition, controllerQuaternion){
    let appObj = {
      "event": "receive_app_binded",
      "time": Date.now(),
      "appID": appID,
      "appPosition" : appPosition.toArray(),
      "appQuaternion" : appQuaternion.toArray(),
      "isBoundToController1" : isBoundToController1,
      "controllerPosition" : controllerPosition.toArray(),
      "controllerQuaternion" : controllerQuaternion.toArray()
    }
    this.get('webSocket').enqueueIfOpen(appObj);
  },

  /**
   * Informs the backend that an application is no longer bound but released
   * @param {Long} appID ID of the bound app
   * @param {Vector3} position Position of the app (x, y, z)
   * @param {Quaternion} quaternion Quaternion of the app (x, y, z, w)
   */
  sendAppReleased(appID, position, quaternion){
    let appObj = {
      "event": "receive_app_released",
      "time": Date.now(),
      "id": appID,
      "position" : position.toArray(),
      "quaternion" : quaternion.toArray()
    }
    this.get('webSocket').enqueueIfOpen(appObj);
  },

  /**
   * Informs the backend that a component was opened or closed by this user
   * @param {Long} appID ID of the app which is a parent to the component
   * @param {Long} componentID ID of the component which was opened or closed
   * @param {boolean} isOpened Tells whether the component is now open or closed (current state)
   */
  sendComponentUpdate(appID, componentID, isOpened, isFoundation){
    let appObj = {
      "event": "receive_component_update",
      "time": Date.now(),
      "appID": appID,
      "componentID": componentID,
      "isOpened": isOpened,
      "isFoundation": isFoundation
    }
    this.get('webSocket').enqueueIfOpen(appObj);
  },

  /**
   * Informs the backend that an entity (clazz or component) was highlighted
   * or unhighlighted
   * @param {boolean} isHighlighted Tells whether the entity has been highlighted or not
   * @param {Long} appID ID of the parent application of the entity
   * @param {Long} entityID ID of the highlighted/unhighlighted component/clazz
   * @param {string} color Original color of the entity as hex value
   */
  sendHighlightingUpdate(userID, isHighlighted, appID, entityID, color){
    let hightlightObj = {
      "event": "receive_hightlight_update",
      "time": Date.now(),
      "userID" : userID,
      "appID": appID,
      "entityID": entityID,
      "isHighlighted": isHighlighted,
      "color": color
    }
    this.get('webSocket').enqueueIfOpen(hightlightObj);
  },

  /**
   * Informs backend that this user entered or left spectating mode
   * and additionally adds who is spectating who
   */
  sendSpectatingUpdate(userID, state, spectatedUser){
    let spectateObj = {
      "event": "receive_spectating_update",
      "userID": userID,
      "isSpectating": state === 'spectating',
      "spectatedUser": spectatedUser,
      "time": Date.now()
    }
    this.get('webSocket').enqueueIfOpen(spectateObj);
  },

  /**
   * Informs the backend if a controller was connected/disconnected
   */
  sendControllerUpdate(connect, disconnect) {
    let controllerObj = {
      "event": "receive_user_controllers",
      "time": Date.now(),
      "connect": connect,
      "disconnect": disconnect
    };

    this.get('webSocket').enqueueIfOpen(controllerObj);
  },

  /**
   * Inform the backend that an app was opened by this
   * user
   * @param {Long} id ID of nodegroup which was opened/closed
   * @param {boolean} isOpen State of the nodegroup
   */
  sendAppOpened(id, app){
    let position = new THREE.Vector3();
    app.getWorldPosition(position);

    let quaternion = new THREE.Quaternion();
    app.getWorldQuaternion(quaternion);

    let appObj = {
      "event": "receive_app_opened",
      "time": Date.now(),
      "id": id,
      "position" : position.toArray(),
      "quaternion" : quaternion.toArray()
    }
    this.get('webSocket').enqueueIfOpen(appObj);
  }
});
