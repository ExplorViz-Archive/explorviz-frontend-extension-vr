import Service, { inject as service } from '@ember/service';
import Evented from '@ember/object/evented';
import THREE from 'three';

export default Service.extend(Evented, {
  websockets: service(), //service needed to use websockets

  _socketRef: null, //websocket to send/receive messages to/from backend
  _updateQueue: null, // Messages which are ready to be sent to backend
  
  host: null,
  port: null,

  /**
   * Establish a websocket connection and initialize needed handlers.
   * 
   * @param {string} host The host address.
   * @param {number} port The socket's port.
   */
  initSocket() {
    this.set('_updateQueue', []);
    const socket = this.get('websockets').socketFor(`ws://${this.get('host')}:${this.get('port')}/`);
    socket.on('open', this._openHandler, this);
    socket.on('message', this._messageHandler, this);
    socket.on('close', this._closeHandler, this);
    this.set('_socketRef', socket);
  },

  closeSocket() {
    this.get('websockets').closeSocketFor(`ws://${this.get('host')}:${this.get('port')}/`);
    // close handlers
    const socket = this.get('_socketRef');
    if(socket) {
      socket.off('open', this._openHandler);
      socket.off('message', this._messageHandler);
      socket.off('close', this._closeHandler);
    }
    this.set('_socketRef', null);
    this.set('_updateQueue', null);
  },

  _closeHandler(event) {
    // if(this.state === 'connecting')
    //  HintMenu.showHint.call(this, 'Could not establish connection', 3);

    this.disconnect();
  },

  // Called when the websocket is opened for the first time
  _openHandler(event) {
  },

  _messageHandler(event) {
    // Backend could have sent multiple messages at a time
    const messages = JSON.parse(event.data); 
    for(let i = 0; i < messages.length; i++) {
      let data = messages[i];
      this.trigger(data.event, data)
    }
  },

  // Used to send messages to the backend
  send(obj) {
    if(this.get('_socketRef'))
      this.get('_socketRef').send(JSON.stringify(obj));
  },

  sendDisconnectRequest() {
    const disconnectMessage = [{
      "event": "receive_disconnect_request"
    }];
    this.send(disconnectMessage);
  },

  /**
   * Check wether there are messages in the update queue and send them to the backend.
   */
  sendUpdates() {
    // there are updates to send
    if(this.get('_updateQueue').length > 0) {
      this.send(this.get('_updateQueue'));
      this.set('_updateQueue', []);
    }
  },

  enqueue(JSONObj) {
    if(this.get('_updateQueue')) {
      this.get('_updateQueue').push(JSONObj);
    }
  },

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
    this.enqueue(landscapeObj);
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
    this.enqueue(systemObj);
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
    this.enqueue(nodeGroupObj);
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
    this.enqueue(appObj);
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
    this.enqueue(appObj);
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
    this.enqueue(appObj);
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
    this.enqueue(appObj);
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
    this.enqueue(hightlightObj);
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
    this.enqueue(spectateObj);
  },

  /**
   * Informs the backend if a controller was connected/disconnected
   */
  sendControllerUpdate(disconnect, connect) {
    let controllerObj = {
      "event": "receive_user_controllers",
      "time": Date.now(),
      disconnect,
      connect
    };

    this.enqueue(controllerObj);
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
    this.enqueue(appObj);
  }
});
