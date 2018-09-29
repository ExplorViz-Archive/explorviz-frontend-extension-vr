import THREE from 'three';

/**
 * Send update of position + quaternion of the
 * landscape (vrEnvironment)
 */
export function sendLandscapeUpdate(deltaPosition){
  let quaternion =  this.get('vrEnvironment').quaternion;

  let landscapeObj = {
    "event": "receive_landscape_position",
    "time": Date.now(),
    "deltaPosition" : deltaPosition.toArray(),
    "offset" : this.get('environmentOffset').toArray(),
    "quaternion" : quaternion.toArray()
  }
  this.get('updateQueue').push(landscapeObj);
}

/**
 * Send the backend the information that a system was
 * closed or opened by this user
 * @param {Long} id ID of system which was opened/closed
 * @param {boolean} isOpen State of the system
 */
export function sendSystemUpdate(id, isOpen){
  let systemObj = {
    "event": "receive_system_update",
    "time": Date.now(),
    "id": id,
    "isOpen": isOpen
  }
  this.get('updateQueue').push(systemObj);
}

/**
 * Send the backend the information that a nodegroup was
 * closed or opened by this user
 * @param {Long} id ID of nodegroup which was opened/closed
 * @param {boolean} isOpen State of the nodegroup
 */
export function sendNodegroupUpdate(id, isOpen){
  let nodeGroupObj = {
    "event": "receive_nodegroup_update",
    "time": Date.now(),
    "id": id,
    "isOpen": isOpen
  }
  this.get('updateQueue').push(nodeGroupObj);
}

/**
 * Inform the backend that an application was closed
 * by this user
 * @param {Long} appID ID of the closed application
 */
export function sendAppClosed(appID){
  let appObj = {
    "event": "receive_app_closed",
    "time": Date.now(),
    "id": appID
  }
  this.get('updateQueue').push(appObj);
}

/**
 * Informs the backend that this user holds/moves an application
 * @param {Long} appID ID of the bound app
 * @param {Vector3} appPosition Position of the app (x, y, z)
 * @param {Quaternion} appQuaternion Quaternion of the app (x, y, z, w)
 * @param {boolean} isBoundToController1 Tells if app is hold by left controller
 * @param {Vector3} controllerPosition Position of the controller which holds the application
 * @param {Quaternion} controllerQuaternion Quaternion of the controller which holds the application
 */
export function sendAppBinded(appID, appPosition, appQuaternion, isBoundToController1, controllerPosition, controllerQuaternion){
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
  this.get('updateQueue').push(appObj);
}

/**
 * Informs the backend that an application is no longer bound but released
 * @param {Long} appID ID of the bound app
 * @param {Vector3} position Position of the app (x, y, z)
 * @param {Quaternion} quaternion Quaternion of the app (x, y, z, w)
 */
export function sendAppReleased(appID, position, quaternion){
  let appObj = {
    "event": "receive_app_released",
    "time": Date.now(),
    "id": appID,
    "position" : position.toArray(),
    "quaternion" : quaternion.toArray()
  }
  this.get('updateQueue').push(appObj);
}

/**
 * Informs the backend that a component was opened or closed by this user
 * @param {Long} appID ID of the app which is a parent to the component
 * @param {Long} componentID ID of the component which was opened or closed
 * @param {boolean} isOpened Tells whether the component is now open or closed (current state)
 */
export function sendComponentUpdate(appID, componentID, isOpened, isFoundation){
  let appObj = {
    "event": "receive_component_update",
    "time": Date.now(),
    "appID": appID,
    "componentID": componentID,
    "isOpened": isOpened,
    "isFoundation": isFoundation
  }
  this.get('updateQueue').push(appObj);
}

/**
 * Informs the backend that an entity (clazz or component) was highlighted
 * or unhighlighted
 * @param {boolean} isHighlighted Tells whether the entity has been highlighted or not
 * @param {Long} appID ID of the parent application of the entity
 * @param {Long} entityID ID of the highlighted/unhighlighted component/clazz
 * @param {string} color Original color of the entity as hex value
 */
export function sendHighlightingUpdate(isHighlighted, appID, entityID, color){
  let hightlightObj = {
    "event": "receive_hightlight_update",
    "time": Date.now(),
    "userID" : this.get('userID'),
    "appID": appID,
    "entityID": entityID,
    "isHighlighted": isHighlighted,
    "color": color
  }
  this.get('updateQueue').push(hightlightObj);
}

/**
 * Informs backend that this user entered or left spectating mode
 * and additionally adds who is spectating who
 */
export function sendSpectatingUpdate(){
  let spectateObj = {
    "event": "receive_spectating_update",
    "userID": this.get('userID'),
    "isSpectating": this.get('state') === 'spectating',
    "spectatedUser": this.get('spectatedUser'),
    "time": Date.now()
  }
  this.get('updateQueue').push(spectateObj);
}

/**
 * Informs the backend if a controller was connected/disconnected
 */
export function sendControllerUpdate() {
  let controllerObj = {
    "event": "receive_user_controllers",
    "time": Date.now()
  };

  let disconnect = [];
  let connect = {};

  let hasChanged = false;

  //handle that controller 1 has disconnected
  if(this.get('controllersConnected.controller1') && !this.get('controller1').isConnected()) {
    disconnect.push('controller1');
    this.set('controllersConnected.controller1', false);
    hasChanged = true;
  }
  //handle that controller 1 has connected
  else if(!this.get('controllersConnected.controller1') && this.get('controller1').isConnected()) {
    connect.controller1 = this.get('controller1').getGamepad().id;
    this.set('controllersConnected.controller1', true);
    hasChanged = true;
  }

  //handle that controller 2 has disconnected
  if(this.get('controllersConnected.controller2') && !this.get('controller2').isConnected()) {
    disconnect.push('controller2');
    this.set('controllersConnected.controller2', false);
    hasChanged = true;
  }
  //handle that controller 2 has connected
  else if(!this.get('controllersConnected.controller2') && this.get('controller2').isConnected()) {
    connect.controller2 = this.get('controller2').getGamepad().id;
    this.set('controllersConnected.controller2', true);
    hasChanged = true;
  }

  //handle the case that either controller was connected/disconnected
  if(hasChanged) {
    if(Array.isArray(disconnect) && disconnect.length) {
      controllerObj.disconnect = disconnect;
    }
    if(Object.keys(connect).length !== 0) {
      controllerObj.connect = connect;
    }

    //if status of at least one controller has changed, inform backend
    if(controllerObj.disconnect || controllerObj.connect) {
      this.get('updateQueue').push(controllerObj);
    }
  }
}

/**
 * Inform the backend that an app was opened by this
 * user
 * @param {Long} id ID of nodegroup which was opened/closed
 * @param {boolean} isOpen State of the nodegroup
 */
export function sendAppOpened(id, app){
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
  this.get('updateQueue').push(appObj);
}