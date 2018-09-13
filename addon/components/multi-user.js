import { inject as service } from '@ember/service';
import User from '../utils/multi-user/user';
import Helper from '../utils/multi-user/helper';
import Sender from '../utils/multi-user/send';
import VRRendering from './vr-rendering';
import Ember from 'ember';
import THREE from 'three';
import Models from '../utils/models';
import Menus, { UserListMenu, OptionsMenu, SpectateMenu,
  LandscapePositionMenu, CameraHeightMenu, MessageBox, ConnectMenu, HintMenu }  from '../utils/multi-user/menus';

/**
 * This component extends the functionalities of vr-rendering so that multiple users
 * can use the vr-mode of ExplorViz. In its core a websocket with a tcp connection 
 * to the backend is used to send and receive updates about the landscape, applications and
 * other users.
 *
 * @class MULTI-USER
 * @extends vr-rendering
 */
export default VRRendering.extend(Ember.Evented, {
  websockets: service(), //service needed to use websockets
  socketRef: null, //websocket to send/receive messages to/from backend
  
  users: null, // Map: UserID -> User
  userID: null, // Own userID
  color: null, // Own color
  state: null, // Own connection status, state in {'connecting', 'connected', 'spectating'}
  lastPositions: null, // Last positions of camera and controllers
  controllersConnected: null, // Tells which controller(s) are connected
  fps: 90, // Tells how many pictures are max. rendered per second (refresh rate of Vive/Rift is 90)
  updatesPerSecond: 90, // Tells how many times per seconds msg can be sent to backend
  badConnectionUpdates: 15, // Tells how many updates are sent per second in case of a bad connection
  lastViewTime: null, // Last time an image was rendered
  currentTime: null, // Tells the current time in ms
  deltaViewTime: null, // Time between two frames
  deltaUpdateTime: null, // Time between two update messages
  lastUpdateTime: null, // Last time an update was sent
  updateQueue: null, // Messages which are ready to be sent to backend
  running: null, // Tells if gameLoop is executing
  spectatedUser: null, // Tells which userID (if any) is being spectated
  startPosition: null, // Position before this user starts spectating
  session: service(), // Session used to retrieve username
  connectionIsGood: true, // Tells whether or not backend has recently send a 'bad_connection' msg 
  badConnectionSince: null, // If there is a bad connection, contains timestamp of last 'bad_connection' msg


  gameLoop() {
    if(!this.get('running')) {
      return;
    }

    this.set('currentTime', new Date().getTime());

    //time difference between now and the last time updates were sent
    this.set('deltaViewTime',  this.get('currentTime') - this.get('lastViewTime'));
    this.set('deltaUpdateTime', this.get('currentTime') - this.get('lastUpdateTime'));

    if(this.get('userID') && this.get('state') === 'spectating') {
      this.spectateUser(); // follow view of spectated user
    }

    this.updateControllers();

    if(this.get('userID') && this.get('state') === 'connected' || this.get('state') === 'spectating')
      this.updateUserNameTags();

    this.render2();

    this.set('lastViewTime', this.get('currentTime'));

    if(this.get('userID') && this.get('state') === 'connected' || this.get('state') === 'spectating') {
      this.update();
    } 

    //send messages like connecting request, position updates etc.
    if(this.get('state') !== 'offline')
      this.sendUpdates();

    this.set('lastUpdateTime', this.get('currentTime'));

    //if(this.get('state') === 'connected' || this.get('state') === 'spectating')
    //  this.checkForBadConnection();
  },

  handleBadConnection(){
    this.set('connectionIsGood', false);
    this.set('badConnectionSince', new Date().getTime());
    this.set('updatesPerSecond', this.get('badConnectionUpdates'));
  },

  checkForBadConnection(){
    if (this.get('connectionIsGood') || this.get('badConnectionSince') === null){
      return;
    }

    // check if bad connection data is still up to date (30 seconds or newer)
    if ((this.get('currentTime') - this.get('badConnectionSince')) / 1000 > 30){
      this.set('badConnectionSince', null);
      this.set('updatesPerSecond', this.get('fps'));
      return;
    }
  },

  /**
   * Set user name tag to be directly above their head
   * and set rotation such that it looks toward our camera.
   */
  updateUserNameTags() {
    let users = this.get('users').values();
    let pos = new THREE.Vector3();
    this.get('camera').getWorldPosition(pos);
    for(let user of users) {
      if(user.get('state') === 'connected') {
        user.get('namePlane.position').setFromMatrixPosition( user.get('camera.model').getObjectByName('dummyPlaneName').matrixWorld );
        user.get('namePlane').lookAt(pos);
        user.get('namePlane').updateMatrix();
      }
    }
  },

  /**
   * Used in spectating mode to set user's camera position to the spectated user's position
   */
  spectateUser(){
    if (this.get('spectatedUser') === null || !this.get('users').get(this.get('spectatedUser'))){
      this.deactivateSpectating();
      return;
    }

    let spectatedUser = this.get('users').get(this.get('spectatedUser'));
    let position = spectatedUser.get('camera.position');

    const cameraOffset = new THREE.Vector3();
    
    cameraOffset.copy(this.get('camera.position'));
    this.get('user.position').subVectors(new THREE.Vector3(position.x, position.y, position.z), cameraOffset); 
  },

  /**
   * Switches our user into spectator mode
   * @param {number} userID The id of the user to be spectated
   */
  activateSpectating(userID){
    if(this.get('state') === 'spectating'){
      this.deactivateSpectating();
    }

    if(!this.get('users').has(userID)){
      return;
    }
    this.set('startPosition', this.get('user.position').clone());
    this.set('spectatedUser', userID);
    let spectatedUser = this.get('users').get(userID);

    //other user's hmd should be invisible
    spectatedUser.set('camera.model.visible', false);
    spectatedUser.set('namePlane.visible', false);
    this.set('state', 'spectating');
    Sender.sendSpectatingUpdate.call(this);
  },

  /**
   * Deactives spectator mode for our user
   */
  deactivateSpectating(){
    if(!this.spectatedUser)
      return;
    
    let spectatedUser = this.get('users').get(this.get('spectatedUser'));
    spectatedUser.set('camera.model.visible', true);
    spectatedUser.set('namePlane.visible', true);
    this.set('state', 'connected');
    ConnectMenu.setState.call(this, 'connected');
    this.set('spectatedUser', null);

    SpectateMenu.updateText('spectating_user', 'Spectating off');

    let position = this.get('startPosition');
    this.get('user.position').fromArray(position.toArray());

    Sender.sendSpectatingUpdate.call(this);
  },



  /**
   * Main rendering method. Is called render2 to avoid name conflict with built-in 
   * render() method
   */
  render2() {
    this.get('threexStats').update(this.get('webglrenderer'));
    this.get('stats').begin();
    this.get('webglrenderer').render(this.get('scene'), this.get('camera'));
    this.get('stats').end();
  },

  /**
   * This function is the entry point for this component. 
   * It is called once when the site has loaded.
   */
  didRender() {
    this._super(...arguments);

    this.initVariables();
    this.initInteractions();

    let host, port;
    Ember.$.getJSON("config/config_multiuser.json").then(json => {
      host = json.host;
      port = json.port;

      if(!host || !port) {
        console.log('Config not found');
        return;
      }

      this.host = host;
      this.port = port;

      ConnectMenu.open.call(this, OptionsMenu.open);
      console.log("Start gameLoop");
      this.set('running', true);
      this.get('webglrenderer').setAnimationLoop(this.gameLoop.bind(this));
    });
  },

  connect() {
    this.set('state', 'connecting');
    ConnectMenu.setState.call(this, 'connecting');
    this.set('updateQueue', []);
    this.initSocket(this.get('host'), this.get('port'));
  },

  initVariables() {
    this.set('currentTime', 0);
    this.set('deltaViewTime', 0);
    this.set('deltaUpdateTime', 0);
    this.set('updateQueue', []);
    this.set('running', false);
    this.set('users', new Map());
    this.set('lastPositions', { camera: null, controller1: null, controller2: null });
    this.set('controllersConnected', { controller1: false, controller2: false });
    this.set('lastViewTime', new Date().getTime());
    this.set('lastUpdateTime', new Date().getTime());
    this.set('state', 'offline');
  },

  /**
   * Establish a websocket connection and initialize needed handlers.
   * 
   * @param {string} host The host address.
   * @param {number} port The socket's port.
   */
  initSocket(host, port) {
    const socket = this.get('websockets').socketFor(`ws://${host}:${port}/`);
    socket.on('open', this.openHandler, this);
    socket.on('message', this.messageHandler, this);
    socket.on('close', this.closeHandler, this);
    this.set('socketRef', socket);
  },

  initInteractions() {
    const self = this;

    let old_checkIntersectionRightController = this.get('interaction').checkIntersectionRightController;
    this.get('interaction').checkIntersectionRightController = function() {
      if(self.get('state') !== 'spectating')
        old_checkIntersectionRightController.apply(this, [this.get('raycastObjectsLandscape').concat(Menus.getVisibleMenuMeshesArray())]);
      else {
        old_checkIntersectionRightController.apply(this, [Menus.getVisibleMenuMeshesArray()]);
      }
    };
    
    let old_checkIntersectionLeftController = this.get('interaction').checkIntersectionLeftController;
    this.get('interaction').checkIntersectionLeftController = function() {
      if(self.get('state') !== 'spectating')
        old_checkIntersectionLeftController.apply(this, [this.excludeLandscape().concat(Menus.getVisibleMenuMeshesArray())]);
      else
        self.get('controller1').getObjectByName('controllerLine').scale.z = self.zeroValue;
    };

    let old_onTriggerDownController2 = this.get('interaction').onTriggerDownController2;
    this.get('interaction').onTriggerDownController2 = function(event) {
      if(self.get('state') !== 'spectating')
        old_onTriggerDownController2.apply(this, [event, this.get('raycastObjectsLandscape').concat(Menus.getVisibleMenuMeshesArray())]);
      else
        old_onTriggerDownController2.apply(this, [event, Menus.getVisibleMenuMeshesArray()]);
    };

    let old_onTriggerDownController1 = this.get('interaction').onTriggerDownController1;
    this.get('interaction').onTriggerDownController1 = function(event) {
      if(self.get('state') !== 'spectating')
        old_onTriggerDownController1.apply(this, [event, this.excludeLandscape().concat(Menus.getVisibleMenuMeshesArray())]);
      else
        self.get('controller1').getObjectByName('controllerLine').scale.z = self.zeroValue;
    };

    let old_onMenuDownController1 = this.get('interaction').onMenuDownController1;
    this.get('interaction').onMenuDownController1 = function(event) {
      self.onMenuDownController1();
      old_onMenuDownController1.apply(this, [event]);
    };

    let old_onGripDownController1 = this.get('interaction').onGripDownController1;
    this.get('interaction').onGripDownController1 = function(event) {
      self.onGripDownController1();
      old_onGripDownController1.apply(this, [event]);
    };

    let old_onGripDownController2 = this.get('interaction').onGripDownController2;
    this.get('interaction').onGripDownController2 = function(event) {
      if(self.get('state') !== 'spectating')
        old_onGripDownController2.apply(this, [event]);
    };

    let old_onGripUpController1 = this.get('interaction').onGripUpController1;
    this.get('interaction').onGripUpController1 = function(event) {
      self.onGripUpController1();
      old_onGripUpController1.apply(this, [event]);
    };

    //initialize interaction events and delegate them to the corresponding functions
    this.get('interaction').on('systemStateChanged', (id, isOpen) => {
      Sender.sendSystemUpdate.call(this, id, isOpen);
    });
    this.get('interaction').on('nodegroupStateChanged', (id, isOpen) => {
      Sender.sendNodegroupUpdate.call(this, id, isOpen);
    });
    this.on('applicationOpened', (id, app) => {
      Sender.sendAppOpened.call(this, id, app);
    });
    this.get('interaction').on('removeApplication',(appID) => {
      Sender.sendAppClosed.call(this, appID);
    });
    this.get('interaction').on('appReleased',(appID, position, quaternion) => {
      Sender.sendAppReleased.call(this, appID, position, quaternion);
    });
    this.get('interaction').on('appBinded',(appID, appPosition, appQuaternion, isBoundToController1, controllerPosition, controllerQuaternion) => {
      Sender.sendAppBinded.call(this, appID, appPosition, appQuaternion, isBoundToController1, controllerPosition, controllerQuaternion);
    });
    this.get('interaction').on('componentUpdate', (appID , componentID, isOpened) => {
      Sender.sendComponentUpdate.call(this, appID, componentID, isOpened);
    });
    this.get('interaction').on('landscapeMoved', (deltaPosition) => {
      Sender.sendLandscapeUpdate.call(this, deltaPosition);
    });
    this.get('interaction').on('entityHighlighted', (isHighlighted, appID, entityID, color) => {
      Sender.sendHighlightingUpdate.call(this, isHighlighted, appID, entityID, color);
    });
  },

  /**
   * Check wether there are messages in the update queue and send them to the backend.
   */
  sendUpdates() {
    //there are updates to send
    if(this.get('updateQueue').length > 0) {
      this.send(this.get('updateQueue'));
      this.set('updateQueue', []);
    }
  },

  /**
   * Handles menu-down controller iteraction.
   */
  onMenuDownController1() {
    // Open options menu if no other menu is open
    // Else closes current menu or goes back one menu if possible.
    if(this.get('state') !== 'spectating') {
      if(OptionsMenu.isOpen())
        OptionsMenu.close.call(this);
      else if(CameraHeightMenu.isOpen())
        CameraHeightMenu.back.call(this);
      else if(LandscapePositionMenu.isOpen())
        LandscapePositionMenu.back.call(this);
      else if(SpectateMenu.isOpen())
        SpectateMenu.back.call(this);
      else if(ConnectMenu.isOpen())
        ConnectMenu.back.call(this);
      else
        OptionsMenu.open.call(this);
    } else {
      this.deactivateSpectating();
      SpectateMenu.back.call(this);
    }
  },

  /**
   * Handles grip-down controller iteraction.
   * Opens user list menu if online.
   */
  onGripDownController1() {
    if(this.get('state') === 'connected' || this.get('state') === 'spectating')
      UserListMenu.open.call(this);
    else
      HintMenu.showHint.call(this, "You can't open the user list when offline!", 3);
  },

  onGripUpController1() {
    UserListMenu.close.call(this);
  },

  /**
   * Update position data and data on controller connections
   */
  update() {
    this.updateAndSendPositions();
    Sender.sendControllerUpdate.call(this);
  },

  /**
   * If changed, sends a message of new camera and controller positions and quaternions.
   */
  updateAndSendPositions() {
    if(this.get('camera') && this.get('user') && !this.get('lastPositions.camera')) {
      const pos = new THREE.Vector3();
      this.get('camera').getWorldPosition(pos);
      this.set('lastPositions.camera', pos.toArray());
    }
    if(this.get('controller1') && !this.get('lastPositions.controller1')) {
      const pos = new THREE.Vector3();
      this.get('controller1').getWorldPosition(pos);
      this.set('lastPositions.controller1', pos.toArray());
    }
    if(this.get('controller2') && !this.get('lastPositions.controller2')) {
      const pos = new THREE.Vector3();
      this.get('controller2').getWorldPosition(pos);
      this.set('lastPositions.controller2', pos.toArray());
    }

    let positionObj = {
      "event": "receive_user_positions",
      "time": Date.now()
    };

    const posCamera = new THREE.Vector3();
    this.get('camera').getWorldPosition(posCamera);

    const posController1 = new THREE.Vector3();
    this.get('controller1').getWorldPosition(posController1);

    const posController2 = new THREE.Vector3();
    this.get('controller2').getWorldPosition(posController2);

    let currentPositions = {
      controller1: posController1.toArray(),
      controller2: posController2.toArray(),
      camera: posCamera.toArray()
    }

    // Use world quaternions because controller can also be rotated via controllerGroup
    let controller1Quaternion = new THREE.Quaternion();
    this.get('controller1').getWorldQuaternion(controller1Quaternion);

    let controller2Quaternion = new THREE.Quaternion();
    this.get('controller2').getWorldQuaternion(controller2Quaternion);

    let hasChanged = false;

    if(JSON.stringify(currentPositions.controller1) !== JSON.stringify(this.get('lastPositions.controller1'))) {
      hasChanged = true;
      positionObj.controller1 = {
        "position": currentPositions.controller1,
        "quaternion": controller1Quaternion.toArray()
      };
    }
    if(JSON.stringify(currentPositions.controller2) !== JSON.stringify(this.get('lastPositions.controller2'))) {
      hasChanged = true;
      positionObj.controller2 = {
        "position": currentPositions.controller2,
        "quaternion": controller2Quaternion.toArray()
      };
    }
    if(JSON.stringify(currentPositions.camera) !== JSON.stringify(this.get('lastPositions.camera'))) {
      hasChanged = true;
      positionObj.camera = {
        "position": currentPositions.camera,
        "quaternion": this.get('camera.quaternion').toArray()
      };
    }

    if(hasChanged) {
      this.set('lastPositions', currentPositions);
      this.get('updateQueue').push(positionObj);
    }
  },

  /**
   * Inform the backend that user leaves the session
   */
  disconnect(sendMessage) {
    if(sendMessage) {
      const disconnectMessage = [{
        "event": "receive_disconnect_request"
      }];
      this.send(disconnectMessage);
    }

    // Set own state to offline
    this.set('state', 'offline');
    ConnectMenu.setState.call(this, 'offline');
    
    // Remove other users and their corresponding models
    let users = this.users.values();
    for(let user of users) {
      this.get('scene').remove(user.get('controller1.model'));
      user.removeController1();
      this.get('scene').remove(user.get('controller2.model'));
      user.removeController2();
      this.get('scene').remove(user.get('camera.model'));
      user.removeCamera();
      this.get('scene').remove(user.get('namePlane'));
      user.removeNamePlane();
      this.get('users').delete(user.get('id'));
    }

    // close socket
    this.get('websockets').closeSocketFor(`ws://${this.host}:${this.port}/`);

    const socket = this.get('socketRef');
    if(socket) {
      socket.off('open', this.openHandler);
      socket.off('message', this.messageHandler);
      socket.off('close', this.closeHandler);
    }
    this.set('socketRef', null),
    this.set('userID', null);
    this.set('updateQueue', []);
    this.set('controllersConnected', null);
  },


  /**
   * Handles all incoming messages of the backend and delegates data to
   * the corresponding function
   * @param {JSON} event Event of websocket containing all messages of backend
   */
  messageHandler(event) {
    // Backend could have sent multiple messages at a time
    const messages = JSON.parse(event.data); 
    for(let i = 0; i < messages.length; i++) {
      let data = messages[i];
      switch(data.event) {
        case 'receive_self_connecting':
          console.log(data);
          this.onSelfConnecting(data);
          console.log(`You are connecting with id ${this.get('userID')}`);
          break;
        case 'receive_self_connected':
          console.log(data);
          this.onSelfConnected(data);
          console.log(`You just connected with id ${this.get('userID')}`);
          break;
        case 'receive_user_connecting':
          console.log(data);
          console.log(`New client connecting with ID ${data.id}`);
          break;
        case 'receive_user_connected':
          console.log(data);
          this.onUserConnected(data);
          console.log(`${data.user.name} connected with ID ${data.user.id}`);
          break;
        case 'receive_user_positions':
          this.onUserPositions(data);
          break;
        case 'receive_user_controllers':
          console.log(data);
          this.onUserControllers(data);
          break;
        case 'receive_user_disconnect':
          console.log(data);
          this.onUserDisconnect(data);
          break;
        case 'receive_landscape':
          console.log(data);
          this.onInitialLandscape(data);
          break;
          case 'receive_landscape_position':
          console.log(data);
          this.onLandscapePosition(data.deltaPosition, data.quaternion);
          break;
        case 'receive_system_update':
          console.log(data);
          this.onLandscapeUpdate(data.id, data.isOpen);
          break;
        case 'receive_nodegroup_update':
          console.log(data);
          this.onLandscapeUpdate(data.id, data.isOpen);
          break;
        case 'receive_app_opened':
          this.onAppOpened(data.id, data.position, data.quaternion);
          break;
        case 'receive_app_closed':
          this.onAppClosed(data.id);
          break;
        case 'receive_app_binded':
          this.onAppBinded(data.userID, data.appID, data.appPosition, data.appQuaternion, 
            data.isBoundToController1, data.controllerPosition, data.controllerQuaternion);
          break;
        case 'receive_app_released':
          console.log(data);
          this.get('boundApps').delete(data.id);
          this.updateAppPosition(data.id, data.position, data.quaternion);
          break;
        case 'receive_component_update':
          console.log(data);
          this.get('store').peekRecord('component', data.componentID).setOpenedStatus(data.isOpened);
          this.redrawApplication(data.appID);
          break;
        case 'receive_hightlight_update':
          console.log(data);
          this.onHighlightingUpdate(data.userID, data.isHighlighted, data.appID, data.entityID, data.color);
          break;
        case 'receive_spectating_update':
          console.log(data);
          this.onSpectatingUpdate(data.userID, data.isSpectating);
          break;
        case 'receive_ping':
          this.updateQueue.push(data);
          break;
        case 'receive_bad_connection':
        this.handleBadConnection();
          break;
      }
    }
  },

  /**
   * After socket has opened to backend client is told his/her userID.
   * Respond by asking for "connected" status.
   * 
   * @param {JSON} data Message containing own userID
   */
  onSelfConnecting(data) {
    // If name is not found, use id as default name
    let name = this.get('session.data.authenticated.username') || "ID: " + data.id;
    this.set('userID', data.id);
    this.set('color', data.color);
    this.get('interaction').set('highlightingColor', Helper.colorToString(data.color));
    let JSONObj = {
      "event": "receive_connect_request",
      name
    };
    this.get('updateQueue').push(JSONObj);
  },

  /**
   * After succesfully connecting to the backend, create and spawn other users.
   * 
   * @param {JSON} data Message containing data on other users.
   */
  onSelfConnected(data) {
    // Create User model for all users and add them to the users map
    for (let i = 0; i < data.users.length; i++) {
      const userData = data.users[i];
      let user = new User();
      user.set('name', userData.name);
      user.set('id', userData.id);
      user.set('color', userData.color);
      user.set('state', 'connected');
      this.get('users').set(userData.id, user);

      if(userData.controllers.controller1)
        this.loadController1(userData.controllers.controller1, userData.id);
      if(userData.controllers.controller2)
        this.loadController2(userData.controllers.controller2, userData.id);

      user.initCamera(Models.getHMDModel());
      // Add models for other users
      this.get('scene').add(user.get('camera.model'));

      // Set name for user on top of his hmd 
      this.addUsername(userData.id);
    }
    this.set('state', 'connected');
    ConnectMenu.setState('connected');
    this.set('controllersConnected', { controller1: false, controller2: false });

    console.log("onSelfConnected()");

    // Remove any open apps which may still exist from offline mode
    this.removeOpenApps();

    // Reset landscape position
    this.set('environmentOffset', new THREE.Vector3(0, 0, 0));
    this.get('vrEnvironment').rotation.x =  -1.5708;
    this.updateObjectMatrix(this.get('vrEnvironment'));
  },

  /**
   * Loads specified controller 1 model for given user and add it to scene.
   * 
   * @param {string} controllerName 
   * @param {number} userID 
   */
  loadController1(controllerName, userID) {
    const user = this.get('users').get(userID);

    if(!user)
      return;

    user.initController1(controllerName, this.getControllerModelByName(controllerName));

    this.get('scene').add(user.get('controller1.model'));
    this.addLineToControllerModel(user.get('controller1'), user.get('color'));
  },

  /**
   * Loads specified controller 2 model for given user and add it to scene.
   * 
   * @param {string} controllerName 
   * @param {number} userID 
   */
  loadController2(controllerName, userID) {
    const user = this.get('users').get(userID);

    if(!user)
      return;

    user.initController2(controllerName, this.getControllerModelByName(controllerName));

    this.get('scene').add(user.get('controller2.model'));
    this.addLineToControllerModel(user.get('controller2'), user.get('color'));
  },

  /**
   * Returns controller model that matches the controller's name. Returns Vive controller if no match.
   * 
   * @param {string} name - The contoller's id.
   */
  getControllerModelByName(name) {
    if(name === 'Oculus Touch (Left)')
      return Models.getOculusLeftControllerModel();
    else if(name === 'Oculus Touch (Right)')
      return Models.getOculusRightControllerModel();
    else
      return Models.getViveControllerModel();
  },

  /**
   * Adds the connecting user and informs our user about their connect.
   * 
   * @param {JSON} data - The initial data of the user connecting.
   */
  onUserConnected(data) {
    let user = new User();
    user.set('name', data.user.name);
    user.set('id', data.user.id);
    user.set('color', data.user.color);
    user.set('state', 'connected');
    console.log(user);
    user.initCamera(Models.getHMDModel());
    this.get('users').set(data.user.id, user);

    //add model for new user
    this.get('scene').add(user.get('camera.model'));

    this.addUsername(data.user.id);

    MessageBox.enqueueMessage.call(this, {title: 'User connected', text: user.get('name'), color: Helper.rgbToHex(user.get('color'))}, 3000);
  },

  /**
   * Removes the user that disconnected and informs our user about it.
   * 
   * @param {JSON} data - Contains the id of the user that disconnected.
   */
  onUserDisconnect(data) {
    let { id } = data;

    //do not spectate a disconnected user
    if (this.get('state') === 'spectating' && this.get('spectatedUser') === id) {
      this.deactivateSpectating();
    }

    // Removes user and their models.
    // Informs our user about their disconnect.
    if(this.get('users') && this.get('users').has(id)) {
      //unhighlight possible objects of disconnected user
      this.onHighlightingUpdate(id, false);
      let user = this.get('users').get(id);
      this.get('scene').remove(user.get('controller1.model'));
      user.removeController1();
      this.get('scene').remove(user.get('controller2.model'));
      user.removeController2();
      this.get('scene').remove(user.get('camera.model'));
      user.removeCamera();
      this.get('scene').remove(user.get('namePlane'));
      user.removeNamePlane();
      this.get('users').delete(id);
      MessageBox.enqueueMessage.call(this, {title: 'User disconnected', text: user.get('name'), color: Helper.rgbToHex(user.get('color'))}, 3000);
    }
  },

  /**
   * Updates the specified user's camera and controller positions.
   * 
   * @param {JSON} data - Data needed to update positions.
   */
  onUserPositions(data) {
    let { camera, id, controller1, controller2 } = data;
    if(this.get('users').has(id)) {
      let user = this.get('users').get(id);
      if(controller1)
        user.updateController1(controller1);
      if(controller2)
        user.updateController2(controller2);
      if(camera)
        user.updateCamera(camera);
    }
  },

  /**
   * Handles the (dis-)connect of the specified user's controller(s).
   * 
   * @param {JSON} data - Contains id and controller information.
   */
  onUserControllers(data) {
    let { id, disconnect, connect } = data;

    if(!this.get('users').has(id))
      return;

    let user = this.get('users').get(id);
    if(connect) {
      if(connect.controller1)
        this.loadController1(connect.controller1, user.get('id'));
      if(connect.controller2)
        this.loadController2(connect.controller2, user.get('id'));
    }
    if(disconnect) {
      for (let i = 0; i < disconnect.length; i++) {
        const controller = disconnect[i];
        if(controller === 'controller1') {
          this.get('scene').remove(user.get('controller1.model'));
          user.removeController1();
        } else if(controller === 'controller2') {
          this.get('scene').remove(user.get('controller2.model'));
          user.removeController2();
        }
      }
    }
  },
  
  onInitialLandscape(data){
    let systems = data.systems;
    let nodeGroups = data.nodeGroups;
    let openApps = data.openApps;
    this.setLandscapeState(systems, nodeGroups);
    openApps.forEach(app => {
      let openComponents = app.openComponents;
      openComponents.forEach(componentID => {
        this.get('store').peekRecord('component', componentID).setOpenedStatus('true');
      });
      this.showApplication(app.id, app.position, app.quaternion);
    });

    
    if(data.hasOwnProperty('landscape')){
      this.set('environmentOffset', new THREE.Vector3(0, 0, 0));
      let position = data.landscape.position;
      let quaternion = data.landscape.quaternion;
      this.onLandscapePosition(position, quaternion);
    }
  },

  onLandscapePosition(deltaPosition, quaternion){
    this.get('environmentOffset').x += deltaPosition[0];
    this.get('environmentOffset').y += deltaPosition[1];
    this.get('environmentOffset').z += deltaPosition[2];

    this.get('vrEnvironment').position.x += deltaPosition[0];
    this.get('vrEnvironment').position.y += deltaPosition[1];
    this.get('vrEnvironment').position.z += deltaPosition[2];

    this.get('vrEnvironment').quaternion.fromArray(quaternion);

    this.updateObjectMatrix(this.get('vrEnvironment'));
    this.centerVREnvironment(this.get('vrEnvironment'), this.get('room'));
    this.updateObjectMatrix(this.get('vrEnvironment'));
  },

  onLandscapeUpdate(id, isOpen){
    this.setEntityState(id, isOpen);
  },

  onAppOpened(id, position, quaternion){
    this.showApplication(id, position, quaternion);
  },

  onAppClosed(appID){
    if (this.get('openApps').has(appID)) {
      this.get('boundApps').delete(appID);
      this.removeChildren(this.get('openApps').get(appID));
      this.get('openApps').delete(appID);
    } 
  },

  onAppBinded(userID, appID, appPosition, appQuaternion, isBoundToController1, controllerPosition, controllerQuaternion){
    this.get('boundApps').add(appID);

    this.updateAppPosition(appID, appPosition, appQuaternion);

    if (!this.get('openApps').has(appID)){
      return;
    }

    let app = this.get('openApps').get(appID);

    let controller;
    if (isBoundToController1){
      controller = this.get('users').get(userID).get('controller1.model');
    } else {
      controller = this.get('users').get(userID).get('controller2.model');
    }

    controller.position.fromArray(controllerPosition);
    controller.quaternion.fromArray(controllerQuaternion);

    // Add object to controller
    controller.add(app);
    // Store object 
    controller.userData.selected = app; 

  },

  /**
   * Updates the state of given user to spectating or connected.
   * Hides them if spectating.
   * 
   * @param {number} userID - The user's id.
   * @param {boolean} isSpectating - True, if the user is now spectating, else false.
   */
  onSpectatingUpdate(userID, isSpectating) {
    let user = this.get('users').get(userID);
    if (isSpectating) {
      user.set('state', 'spectating');
      user.setVisible(false);
      if(this.get('state') === 'spectating' && this.get('spectatedUser') === userID) {
        this.deactivateSpectating();
      } else {
        MessageBox.enqueueMessage.call(this, { title: user.get('name'), text: 'is now spectating'}, 2000);
      }
    } else {
      user.set('state', 'connected');
      user.setVisible(true);
      MessageBox.enqueueMessage.call(this, { title: user.get('name'), text: 'is no longer spectating'}, 2000);
    }
  },

  updateAppPosition(appID, position, quatArray){
    if (this.get('openApps').has(appID)) {
      var appPosition = new THREE.Vector3(position[0], position[1], position[2]);
      var appQuaternion = new THREE.Quaternion(quatArray[0], quatArray[1], quatArray[2], quatArray[3]);
      let app3DModel = this.get('openApps').get(appID).userData.model;

      // Empty application 3D (remove app3D)
      this.removeChildren(this.get('openApps').get(appID));

      // Add application3D to scene
      this.add3DApplicationToLandscape(app3DModel, appPosition, appQuaternion);
      this.get('openApps').get(appID).updateMatrix();
     }       
  },

  onHighlightingUpdate(userID, isHighlighted, appID, entityID, originalColor){
    let user = this.get('users').get(userID);

    // Save highlighted entity
    if (isHighlighted){
      this.onHighlightingUpdate(userID, false);
      user.setHighlightedEntity(appID, entityID, originalColor);
    // Restore highlighted entity data
    } else {
      appID = user.highlightedEntity.appID;
      entityID = user.highlightedEntity.entityID;
      originalColor = user.highlightedEntity.originalColor;
    }

    let app = this.get('openApps').get(appID);

    // Return if app is not opened
    if(!app){
      return;
    }

    // Find component/clazz which shall be highlighted
    app.children.forEach( child => {
      if (child.userData.model && child.userData.model.id === entityID){

        let hsl = new Object();
        child.material.emissive.getHSL(hsl);

        if (isHighlighted){
          let colorArray = user.get('color');
          let userColor = new THREE.Color(colorArray[0]/255.0, colorArray[1]/255.0, colorArray[2]/255.0);
          child.material.color = new THREE.Color(userColor);
          // Darken the color (same is done for HMDs)
          child.material.emissive.setHSL(hsl.h, hsl.s, 0.1);
        } else {
          child.material.color = new THREE.Color(originalColor);
          // Lighten color up again
          child.material.emissive.setHSL(hsl.h, hsl.s, 0);
        }
        return;
      }
    });
  },

  /**
   * Adds a controller ray to another user's controller.
   * 
   * @param {Object} controller - The user's controller object.
   * @param {int[]} color - The color of the new ray as 3-element RGB array.
   */
  addLineToControllerModel(controller, color) {
    // Ray for Controller
    this.set('geometry', new THREE.Geometry());
    this.get('geometry').vertices.push(new THREE.Vector3(0, 0, 0));
    this.get('geometry').vertices.push(new THREE.Vector3(0, 0, -1));

    // Create black ray for left controller
    let line = new THREE.Line(this.get('geometry'));
    line.name = 'controllerLine';
    line.scale.z = 5;
    line.material.color = new THREE.Color(0,0,0);
    line.material.color.fromArray([color[0]/255.0,color[1]/255.0,color[2]/255.0]);
    line.material.opacity = 0.25;
    line.position.y -= 0.005;
    line.position.z -= 0.02;
    controller.model.add(line);
  },

  /**
   * Adds a username on top of another user's hmd
   * 
   * @param {Long} userID : user to which a username shall be added 
   */
  addUsername(userID){
    let user = this.get('users').get(userID);
    let camera = user.get('camera').model;
    let username = user.get('name');

    let textSize = Helper.getTextSize(username);

    // Width according to textsize, will be automatically resized to a power of two
    let width = textSize.width * 3 + 20;
    let height = textSize.height * 5;

    // Use canvas to display text
    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = width;
    this.get('canvas2').height = height;
    let canvas2 = this.get('canvas2');
    var ctx = canvas2.getContext('2d');
    ctx.fillStyle = 'rgba(200, 200, 216, 0.5)'; // Light grey
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);


    ctx.font = `30px arial`;
    ctx.fillStyle = Helper.rgbToHex(user.get('color')); // Username is colored in corresponding color
    ctx.textAlign = 'center';
    ctx.fillText(username, canvas2.width / 2, 35);
       
    // Create texture out of canvas
    let texture = new THREE.Texture(canvas2);

    // Update texture      
    texture.needsUpdate = true;

    let geometry = new THREE.PlaneGeometry(width / 500, height / 500, 32 );
    let material = new THREE.MeshBasicMaterial( {map: texture, color: 0xffffff, side: THREE.DoubleSide} );
    material.transparent = true;
    material.opacity = 0.8; // Make username tag slightly transparent
    let plane = new THREE.Mesh( geometry, material );

    // Use dummy object to let username always face camera with lookAt() function
    let dummy = new THREE.Object3D();
    dummy.name = 'dummyPlaneName';

    dummy.position.x = camera.position.x;
    dummy.position.y = camera.position.y + 0.3; // Display username above hmd
    dummy.position.z = camera.position.z;

    user.set('namePlane', plane);

    // Username moves with user
    camera.add(dummy);
    this.get('scene').add(plane);
  },

  setEntityState(id, isOpen){
    const self = this;
    this.get('vrLandscape').children.forEach(function (system) {
      if (system.userData.model && system.userData.model.id === id) {
        system.userData.model.setOpened(isOpen);
        self.populateScene();
        return;
      }
    });
  },

  setLandscapeState(systems, nodegroups){
    // Set system status to opened / closed
    let vrLandscape = this.get('vrLandscape').children;
    systems.forEach(system => {
      let emberModel = this.get('store').peekRecord('system', system.id);
      if (emberModel !== null){
        emberModel.setOpened(system.opened);
      }
    });
    this.populateScene();

    // Use of store like above currently not possible, due to problems with klay
    nodegroups.forEach(function (nodegroup){
      let id = nodegroup.id;
      let isOpen = nodegroup.opened;
      vrLandscape.forEach(entity => {
        if (entity.userData.model && entity.userData.model.id === id) {
          entity.userData.model.setOpened(isOpen);
        }
      });
    });

    this.populateScene();
  },

  showApplication(id, posArray, quatArray){
    this.set('viewImporter.importedURL', null);

    // Get model of application of the store
    let emberModel = this.get('store').peekRecord('application', id);
   
    // Dont allow to have the same app opened twice
    if (this.get('openApps').has(emberModel.id)){
      return;
    }

    // Note that this property is still only working for one app at a time
    this.set('landscapeRepo.latestApplication', emberModel); 
    // Position and quaternion where the application shall be displayed
    let position = new THREE.Vector3().fromArray(posArray);
    let quaternion = new THREE.Quaternion().fromArray(quatArray);
    // Add 3D Application to scene (also if another one exists already)
    this.add3DApplicationToLandscape(emberModel, position, quaternion);

    // Update matrix to display application correctly in the world
    this.get('openApps').get(emberModel.id).updateMatrix();
  },

  /**
   * Moves landscape in all three directions.
   * 
   * @param {{x: number, y: number, z: number}} delta - The amounts to move the landscape by.
   */
  moveLandscape(delta) {
    this.get('environmentOffset').x += delta.x;
    this.get('environmentOffset').y += delta.y;
    this.get('environmentOffset').z += delta.z;

    this.get('vrEnvironment').position.x += delta.x;
    this.get('vrEnvironment').position.y += delta.y;
    this.get('vrEnvironment').position.z += delta.z;
    this.updateObjectMatrix(this.get('vrEnvironment'));

    let deltaPosition = new THREE.Vector3(delta.x, delta.y, delta.z);
    this.get('interaction').trigger('landscapeMoved', deltaPosition);
  },

  /**
   * Moves landscape in all three directions.
   */
  rotateLandscape(delta) {
    //apply rotattion
    this.get('vrEnvironment').rotation.x += delta.x;
    this.get('vrEnvironment').rotation.y += delta.y;
    this.get('vrEnvironment').rotation.z += delta.z;
    this.updateObjectMatrix(this.get('vrEnvironment'));

    //synchronize rotation with other users
    this.get('interaction').trigger('centerVREnvironment');
    this.get('interaction').trigger('landscapeMoved', new THREE.Vector3(0, 0, 0));
  },

  /*
   * This method is used to update the matrix of
   * a given Object3D
   */
  updateObjectMatrix(object) {
    if(object) {
      object.updateMatrix();
    }
  },

  // Called when the websocket is opened for the first time
  openHandler(event) {
    console.log(`On open event has been called: ${event}`);
  },

  // Used to send messages to the backend
  send(obj) {
    // console.log(`Sending: ${JSON.stringify(obj)}`);
    if(this.get('socketRef'))
      this.get('socketRef').send(JSON.stringify(obj));
  },

  // Called when the websocket is closed
  closeHandler(event) {
    console.log(`On close event has been called: ${event}`);
    // ConnectMenu.open.call(this, OptionsMenu.open);
    this.disconnect(false);
  },

  // Called when user closes the site / tab
  willDestroyElement() {
    this._super(...arguments);

    this.set('running', false);
    this.disconnect(true);
    this.set('users', null);
    this.set('userID', null);
    this.set('state', null);
    this.set('lastPositions', null);
    this.set('controllersConnected', null);
    this.set('lastTime', null);
    this.set('currentTime', null);
    this.set('deltaTime', null);
    this.set('running', null);
    this.set('updateQueue', null);
    this.set('spectatedUser', null);
    this.set('startPosition', null);

    navigator.getVRDisplays()
				.then( function ( displays ) {

					if ( displays.length > 0 && displays[0].isPresenting)
            displays[0].exitPresent();
        });
  },

});
