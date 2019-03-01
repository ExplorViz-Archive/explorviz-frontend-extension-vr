import { inject as service } from '@ember/service';
import Evented from '@ember/object/evented';
import THREE from 'three';
import $ from 'jquery';
import Models from '../utils/models';
import { getOwner } from '@ember/application';
import Helper from '../utils/multi-user/helper';
import VRRendering from './vr-rendering';
import Menus, { UserListMenu, OptionsMenu, SpectateMenu, LandscapePositionMenu,
  CameraHeightMenu, MessageBox, ConnectMenu, HintMenu, AdvancedMenu }  from '../utils/multi-user/menus';

/**
 * This component extends the functionalities of vr-rendering so that multiple users
 * can use the vr-mode of ExplorViz. In its core a websocket with a tcp connection 
 * to the backend is used to send and receive updates about the landscape, applications and
 * other users.
 *
 * @class MULTI-USER
 * @extends vr-rendering
 */
export default VRRendering.extend(Evented, {

  tagName: '',

  session: service(), // Session used to retrieve username
  webSocket: service(),
  sender: service(),
  store: service(),
  
  users: null, // Map: UserID -> User
  userID: null, // Own userID
  state: null, // Own connection status, state in {'connecting', 'connected', 'spectating'}
  lastPositions: null, // Last positions of camera and controllers
  controllersConnected: null, // Tells which controller(s) are connected
  lastViewTime: null, // Last time an image was rendered
  deltaTime: null, // Time between two frames in seconds
  running: null, // Tells if main loop is executing
  spectatedUser: null, // Tells which userID (if any) is being spectated
  startPosition: null, // Position before this user starts spectating
  color: null,

  /**
   * Main loop contains all methods which need to be called
   * for every rendering iteration
   */
  mainLoop() {
    if(!this.get('running')) {
      return;
    }

    let currentTime = Date.now() / 1000.0;

    // Time difference between now and the last time updates were sent
    this.set('deltaTime',  currentTime - this.get('lastViewTime'));

    if(this.get('userID') && this.get('state') === 'spectating') {
      this.spectateUser(); // Follow view of spectated user
    }

    // Handle own controller updates and ray intersections
    this.updateControllers();

    // Move name tags to right position and rotate them toward our camera
    if(this.get('userID') && this.get('state') === 'connected' || this.get('state') === 'spectating')
      this.updateUserNameTags();

    // Render scene
    this.renderScene();

    this.set('lastViewTime', currentTime);

    // Add controller / camera updates (position changes, controller disconnect etc.)
    if(this.get('userID') && this.get('state') === 'connected' || this.get('state') === 'spectating') {
      this.update();
    } 

    // actually send messages like connecting request, position updates etc.
    if(this.get('state') !== 'offline')
      this.get('webSocket').sendUpdates();
  },

  /**
   * Main rendering method.
   */
  renderScene() {
    this.get('threexStats').update(this.get('webglrenderer'));
    this.get('stats').begin();
    this.get('webglrenderer').render(this.get('scene'), this.get('camera'));
    this.get('stats').end();
  },

  /**
   * Set user name tag to be directly above their head
   * and set rotation such that it looks toward our camera.
   */
  updateUserNameTags() {
    let users = this.get('store').peekAll('vr-user');
    let pos = new THREE.Vector3();
    this.get('camera').getWorldPosition(pos);
    users.forEach((user) => {
      if (user.get('state') === 'connected') {
        user.get('namePlane.position').setFromMatrixPosition(user.get('camera.model').getObjectByName('dummyPlaneName').matrixWorld);
        user.get('namePlane').lookAt(pos);
        user.get('namePlane').updateMatrix();
      }
    });
  },

  /**
   * Used in spectating mode to set user's camera position to the spectated user's position
   */
  spectateUser(){
    let spectatedUser = this.get('store').peekRecord('vr-user', this.get('spectatedUser'));

    if (!spectatedUser){
      this.deactivateSpectating();
      return;
    }

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
    if (!userID){
      return;
    }

    if(this.get('state') === 'spectating'){
      this.deactivateSpectating();
    }

    let spectatedUser = this.get('store').peekRecord('vr-user', userID);

    if(!spectatedUser){
      return;
    }
    this.set('startPosition', this.get('user.position').clone());
    this.set('spectatedUser', userID);

    // Other user's hmd should be invisible
    spectatedUser.set('camera.model.visible', false);
    spectatedUser.set('namePlane.visible', false);
    this.set('state', 'spectating');
    this.get('sender').sendSpectatingUpdate(this.get('userID'), this.get('state'), this.get('spectatedUser'));
  },

  /**
   * Deactives spectator mode for our user
   */
  deactivateSpectating(){
    if (!this.get('spectatedUser')){
      return;
    }

    let spectatedUser = this.get('store').peekRecord('vr-user', this.get('spectatedUser'));

    if(!this.spectatedUser)
      return;
    
    spectatedUser.set('camera.model.visible', true);
    spectatedUser.set('namePlane.visible', true);
    this.set('state', 'connected');
    this.get('connectMenu').setState('connected');
    this.set('spectatedUser', null);

    this.get('spectateMenu').updateText('spectating_user', 'Spectating off');

    let position = this.get('startPosition');
    this.get('user.position').fromArray(position.toArray());

    this.get('sender').sendSpectatingUpdate(this.get('userID'), this.get('state') /* , null */);
  },

  /**
   * Called once when the site has loaded.
   */
  didRender() {
    this._super(...arguments);

    this.initVariables();
    this.initInteractions();
    this.initListeners();

    this.set('advancedMenu', AdvancedMenu.create());
    this.set('connectMenu', ConnectMenu.create());
    this.set('cameraHeightMenu', CameraHeightMenu.create());
    this.set('landscapePositionMenu', LandscapePositionMenu.create());
    this.set('spectateMenu', SpectateMenu.create(getOwner(this).ownerInjection()));
    this.set('optionsMenu', OptionsMenu.create());

    let host, port;
    $.getJSON('config/config_multiuser.json').then(json => {
      host = json.host;
      port = json.port;

      if(!host || !port) {
        console.error('Config not found');
        return;
      }

      this.set('webSocket.host', host);
      this.set('webSocket.port', port);

      this.get('connectMenu').open(this.get('optionsMenu'), this);
      this.set('running', true);
      this.get('webglrenderer').setAnimationLoop(this.mainLoop.bind(this));
    });
  },

  connect() {
    this.set('state', 'connecting');
    this.get('connectMenu').setState('connecting');
    this.get('webSocket').initSocket();
  },

  /**
   * Initiates properties with default values.
   */
  initVariables() {
    this.set('deltaTime', 0);
    this.set('running', false);
    this.set('lastPositions', { camera: null, controller1: null, controller2: null });
    this.set('controllersConnected', { controller1: false, controller2: false });
    this.set('lastViewTime', Date.now() / 1000.0);
    this.set('state', 'offline');
  },

  initInteractions() {
    const self = this;

    // override actions to prevent users in spectator mode from interacting with landscape, apps or teleport

    let old_checkIntersectionPrimaryController = this.get('interaction').checkIntersectionPrimaryController;
    this.get('interaction').checkIntersectionPrimaryController = function() {
      if(self.get('state') !== 'spectating')
        old_checkIntersectionPrimaryController.apply(this, [this.get('raycastObjectsLandscape').concat(Menus.getVisibleMenuMeshesArray())]);
      else {
        old_checkIntersectionPrimaryController.apply(this, [Menus.getVisibleMenuMeshesArray()]);
      }
    };
    
    let old_checkIntersectionSecondaryController = this.get('interaction').checkIntersectionSecondaryController;
    this.get('interaction').checkIntersectionSecondaryController = function() {
      if(self.get('state') !== 'spectating')
        old_checkIntersectionSecondaryController.apply(this, [this.excludeLandscape().concat(Menus.getVisibleMenuMeshesArray())]);
      else
        self.get('controller1').getObjectByName('controllerLine').scale.z = self.zeroValue;
    };

    let old_onTriggerDownPrimaryController = this.get('interaction').onTriggerDownPrimaryController;
    this.get('interaction').onTriggerDownPrimaryController = function(event) {
      if(self.get('state') !== 'spectating')
        old_onTriggerDownPrimaryController.apply(this, [event, this.get('raycastObjectsLandscape').concat(Menus.getVisibleMenuMeshesArray())]);
      else
        old_onTriggerDownPrimaryController.apply(this, [event, Menus.getVisibleMenuMeshesArray()]);
    };

    let old_onTriggerDownSecondaryController = this.get('interaction').onTriggerDownSecondaryController;
    this.get('interaction').onTriggerDownSecondaryController = function(event) {
      if(self.get('state') !== 'spectating')
      old_onTriggerDownSecondaryController.apply(this, [event, this.excludeLandscape().concat(Menus.getVisibleMenuMeshesArray())]);
      else
        self.get('controller1').getObjectByName('controllerLine').scale.z = self.zeroValue;
    };

    let old_onMenuDownSecondaryController= this.get('interaction').onMenuDownSecondaryController;
    this.get('interaction').onMenuDownSecondaryController = function(event) {
      self.onMenuDownSecondaryController();
      old_onMenuDownSecondaryController.apply(this, [event]);
    };

    let old_onGripDownSecondaryController = this.get('interaction').onGripDownSecondaryController;
    this.get('interaction').onGripDownSecondaryController = function(event) {
      self.onGripDownSecondaryController();
      old_onGripDownSecondaryController.apply(this, [event]);
    };

    let old_onGripDownPrimaryController = this.get('interaction').onGripDownPrimaryController;
    this.get('interaction').onGripDownPrimaryController = function(event) {
      if(self.get('state') !== 'spectating')
        old_onGripDownPrimaryController.apply(this, [event]);
    };

    let old_onGripUpSecondaryController = this.get('interaction').onGripUpSecondaryController;
    this.get('interaction').onGripUpSecondaryController = function(event) {
      self.onGripUpSecondaryController();
      old_onGripUpSecondaryController.apply(this, [event]);
    };

    //initialize interaction events and delegate them to the corresponding functions
    this.get('interaction').on('systemStateChanged', (id, isOpen) => {
      this.get('sender').sendSystemUpdate(id, isOpen);
    });
    this.get('interaction').on('nodegroupStateChanged', (id, isOpen) => {
      this.get('sender').sendNodegroupUpdate(id, isOpen);
    });
    this.on('applicationOpened', (id, app) => {
      this.get('sender').sendAppOpened(id, app);
    });
    this.get('interaction').on('removeApplication',(appID) => {
      this.get('sender').sendAppClosed(appID);
    });
    this.get('interaction').on('appReleased',(appID, position, quaternion) => {
      this.get('sender').sendAppReleased(appID, position, quaternion);
    });
    this.get('interaction').on('appBinded',(appID, appPosition, appQuaternion, isBoundToSecondaryController, controllerPosition, controllerQuaternion) => {
      this.get('sender').sendAppBinded(appID, appPosition, appQuaternion, isBoundToSecondaryController, controllerPosition, controllerQuaternion);
    });
    this.get('interaction').on('componentUpdate', (appID , componentID, isOpened, isFoundation) => {
      this.get('sender').sendComponentUpdate(appID, componentID, isOpened, isFoundation);
    });
    this.get('interaction').on('landscapeMoved', (deltaPosition) => {
      this.get('sender').sendLandscapeUpdate(deltaPosition, this.get('vrEnvironment'), this.get('environmentOffset'));
    });
    this.get('interaction').on('entityHighlighted', (isHighlighted, appID, entityID, color) => {
      this.get('sender').sendHighlightingUpdate(this.get('userID'), isHighlighted, appID, entityID, color);
    });
  },

  /**
   * Handles menu-down controller iteraction.
   */
  onMenuDownSecondaryController() {
    // Open options menu if no other menu is open
    // Else closes current menu or goes back one menu if possible.
    if (this.get('state') !== 'spectating') {
      if (this.get('optionsMenu').isOpen())
        this.get('optionsMenu').close();
      else if (this.get('cameraHeightMenu').isOpen())
        this.get('cameraHeightMenu').back(this);
      else if (this.get('landscapePositionMenu').isOpen())
        this.get('landscapePositionMenu').back(this);
      else if (this.get('spectateMenu').isOpen())
        this.get('spectateMenu').back(this);
      else if (this.get('connectMenu').isOpen())
        this.get('connectMenu').back(this);
      else if (this.get('advancedMenu').isOpen())
        this.get('advancedMenu').back(this);
      else
        this.get('optionsMenu').open(null, this);
    } else {
      this.deactivateSpectating();
      this.get('spectateMenu').back(this);
    }
  },

  /**
   * Handles grip-down controller iteraction.
   * Opens user list menu if online.
   */
  onGripDownSecondaryController() {
    if(this.get('state') === 'connected' || this.get('state') === 'spectating')
      UserListMenu.open.call(this);
    else
      HintMenu.showHint.call(this, 'Cannot open the user list when offline!', 3);
  },

  /**
   * Handles grip-up controller iteraction.
   * Closes user list menu
   */
  onGripUpSecondaryController() {
    UserListMenu.close.call(this);
  },

  /**
   * Update position data and data on controller connections
   */
  update() {
    this.updateAndSendPositions();
    this.get('sender').sendControllerUpdate();
  },

  /**
   * If changed, sends a message of new camera and controller positions and quaternions.
   */
  updateAndSendPositions() {
    // if no last positions exist, set them to current position of camera and controllers
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

    // get current camera and controller positions
    const posCamera = new THREE.Vector3();
    this.get('camera').getWorldPosition(posCamera);

    const posSecondaryController = new THREE.Vector3();
    this.get('controller1').getWorldPosition(posSecondaryController);

    const posController2 = new THREE.Vector3();
    this.get('controller2').getWorldPosition(posController2);

    let currentPositions = {
      controller1: posSecondaryController.toArray(),
      controller2: posController2.toArray(),
      camera: posCamera.toArray()
    }

    // Use world quaternions because controller can also be rotated via controllerGroup
    let controller1Quaternion = new THREE.Quaternion();
    this.get('controller1').getWorldQuaternion(controller1Quaternion);

    let controller2Quaternion = new THREE.Quaternion();
    this.get('controller2').getWorldQuaternion(controller2Quaternion);

    let hasChanged = false;

    // if changed, add new positions and quaternions to message
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

    // send update if either position has changed
    if(hasChanged) {
      this.set('lastPositions', currentPositions);
      this.get('webSocket').enqueueIfOpen(positionObj);
    }
  },

  /**
   * Inform the backend that user leaves the session
   */
  disconnect(sendMessage) {
    if(sendMessage) {
      this.get('sender').sendDisconnectRequest();
    }

    // Set own state to offline
    this.set('state', 'offline');
    this.get('connectMenu').setState('offline');
    
    // Remove other users and their corresponding models and name tags
    let users = this.get('store').peekAll('vr-user');
    users.forEach( (user) => {
      this.get('scene').remove(user.get('controller1.model'));
      user.removeController1();
      this.get('scene').remove(user.get('controller2.model'));
      user.removeController2();
      this.get('scene').remove(user.get('camera.model'));
      user.removeCamera();
      this.get('scene').remove(user.get('namePlane'));
      user.removeNamePlane();
      this.get('store').unloadRecord(user);
    });

    // close socket
    this.get('webSocket').closeSocket();

    this.set('userID', null);
    this.set('controllersConnected', null);
  },

  initListeners() {
    const socket = this.get('webSocket');

    socket.on('connection_closed', () => {
      if (this.get('state') === 'connecting') {
        HintMenu.showHint.call(this, 'Could not establish connection', 3);
      }
      this.disconnect(false);
    });

    socket.on('receive_self_connecting', (data) => { this.onSelfConnecting(data); });
    socket.on('receive_self_connected', (data) => { this.onSelfConnected(data); });
    socket.on('receive_user_connecting', () => { });
    socket.on('receive_user_connected', (data) => { this.onUserConnected(data); });
    socket.on('receive_user_positions', (data) => { this.onUserPositions(data); });
    socket.on('receive_user_controllers', (data) => { this.onUserControllers(data); });
    socket.on('receive_user_disconnect', (data) => { this.onUserDisconnect(data); });
    socket.on('receive_landscape', (data) => { this.onInitialLandscape(data); });
    socket.on('receive_landscape_position', ({ deltaPosition, quaternion }) => { this.onLandscapePosition(deltaPosition, quaternion); });
    socket.on('receive_system_update', ({ id, isOpen }) => { this.onLandscapeUpdate(id, isOpen); });
    socket.on('receive_nodegroup_update', ({ id, isOpen }) => { this.onLandscapeUpdate(id, isOpen); });
    socket.on('receive_app_opened', ({ id, position, quaternion }) => { this.onAppOpened(id, position, quaternion); });
    socket.on('receive_app_closed', ({ id }) => { this.onAppClosed(id); });
    socket.on('receive_app_binded', ({ userID, appID, appPosition, appQuaternion, isBoundToController1, controllerPosition, controllerQuaternion }) => {
      this.onAppBinded(userID, appID, appPosition, appQuaternion, isBoundToController1, controllerPosition, controllerQuaternion);
    });
    socket.on('receive_app_released', ({ id, position, quaternion }) => {
      this.get('boundApps').delete(id);
      this.updateAppPosition(id, position, quaternion);
      this.get('scene').add(this.get('openApps').get(id));
    });
    socket.on('receive_component_update', ({ isFoundation, appID, componentID, isOpened }) => {
      if (isFoundation) {
        this.get('foundations').get(appID).setOpenedStatus(isOpened);
      } else {
        this.get('store').peekRecord('component', componentID).setOpenedStatus(isOpened);
      }
      this.redrawApplication(appID);
    });
    socket.on('receive_hightlight_update', ({ userID, isHighlighted, appID, entityID, color }) => {
      this.onHighlightingUpdate(userID, isHighlighted, appID, entityID, color);
    });
    socket.on('receive_spectating_update', ({ userID, isSpectating }) => {
      this.onSpectatingUpdate(userID, isSpectating);
    });
    socket.on('receive_ping', (data) => {
      this.get('webSocket').enqueueIfOpen(data);
    });
    socket.on('receive_bad_connection', () => { this.handleBadConnection(); });
  },

  /**
   * After socket has opened to backend client is told his/her userID.
   * Respond by asking for "connected" status.
   * 
   * @param {JSON} data Message containing own userID
   */
  onSelfConnecting(data) {
    // If name is not found, use id as default name
    let name = this.get('session.data.authenticated.username') || 'ID: ' + data.id;
    this.set('userID', data.id);
    this.set('color', data.color);
    this.get('interaction').set('highlightingColor', Helper.colorToString(data.color));

    let JSONObj = {
      "event": "receive_connect_request",
      name
    };

    this.get('webSocket').enqueueIfOpen(JSONObj);
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
      let user = this.get('store').createRecord('vr-user', {
        name: userData.name,
        id: userData.id,
        color: userData.color,
        state: 'connected',
      });

      // load controllers
      if (userData.controllers.controller1)
        this.loadController1(userData.controllers.controller1, userData.id);
      if (userData.controllers.controller2)
        this.loadController2(userData.controllers.controller2, userData.id);

      user.initCamera(Models.getHMDModel());

      // Add models for other users
      this.get('scene').add(user.get('camera.model'));

      // Set name for user on top of his hmd 
      this.addUsername(userData.id);
    }
    this.set('state', 'connected');
    this.get('connectMenu').setState('connected');
    this.set('controllersConnected', { controller1: false, controller2: false });

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
    const user = this.get('store').peekRecord('vr-user', userID);

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
    const user = this.get('store').peekRecord('vr-user', userID);

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
    let user = this.get('store').createRecord('vr-user', {
      name: data.user.name,
      id: data.user.id,
      color: data.user.color,
      state: 'connected',
    });

    user.initCamera(Models.getHMDModel());

    //add model for new user
    this.get('scene').add(user.get('camera.model'));

    this.addUsername(data.user.id);

    // show connect notification
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
    let user = this.get('store').peekRecord('vr-user', id)
    if(user) {

      //unhighlight possible objects of disconnected user
      this.onHighlightingUpdate(id, false, user.highlightedEntity.appID, user.highlightedEntity.entityID, user.highlightedEntity.originalColor);

      // remove user's models
      this.get('scene').remove(user.get('controller1.model'));
      user.removeController1();
      this.get('scene').remove(user.get('controller2.model'));
      user.removeController2();
      this.get('scene').remove(user.get('camera.model'));
      user.removeCamera();

      // remove user's name tag
      this.get('scene').remove(user.get('namePlane'));
      user.removeNamePlane();

      // show disconnect notification
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

    let user = this.get('store').peekRecord('vr-user', id);
    if(user) {
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

    let user = this.get('store').peekRecord('vr-user', id);
    if(!user)
      return;

    // load newly connected controller(s)
    if(connect) {
      if(connect.controller1)
        this.loadController1(connect.controller1, user.get('id'));
      if(connect.controller2)
        this.loadController2(connect.controller2, user.get('id'));
    }

    // remove controller model(s) due to controller disconnect
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
      controller = this.get('store').peekRecord('vr-user', userID).get('controller1.model');
    } else {
      controller = this.get('store').peekRecord('vr-user', userID).get('controller2.model');
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
    let user = this.get('store').peekRecord('vr-user', userID);
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
      let app3DModel = this.get('openApps').get(appID);

      app3DModel.position.fromArray(position);
      app3DModel.quaternion.fromArray(quatArray);

      this.get('openApps').get(appID).updateMatrix();
     }       
  },

  onHighlightingUpdate(userID, isHighlighted, appID, entityID, originalColor){
    let user = this.get('store').peekRecord('vr-user', userID);

    // Save highlighted entity
    if (isHighlighted){
      this.onHighlightingUpdate(userID, false, user.highlightedEntity.appID, user.highlightedEntity.entityID, 
        user.highlightedEntity.originalColor); //unhighlight possible old highlighting
      user.setHighlightedEntity(appID, entityID, originalColor); // Restore highlighted entity data
    }

    let app = this.get('openApps').get(appID);

    // Return if app is not opened
    if(!app){
      return;
    }

    // Find component/clazz which shall be highlighted
    app.children.forEach( child => {
      if (child.userData.model && child.userData.model.id === entityID){
        if(this.get('interaction.selectedEntitysMesh') === child && !isHighlighted){
          return;
        }

        if(this.get('interaction.selectedEntitysMesh') === child){
          this.get('interaction').set('selectedEntitysMesh', null);
        }

        if (isHighlighted){
          let colorArray = user.get('color');
          let userColor = new THREE.Color(colorArray[0]/255.0, colorArray[1]/255.0, colorArray[2]/255.0);
          child.material.color = new THREE.Color(userColor);
        } else {
          child.material.color = new THREE.Color(originalColor);
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
  addUsername(userID) {
    let user = this.get('store').peekRecord('vr-user', userID);
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

  setEntityState(id, isOpen) {
    this.get('vrLandscape').children.forEach((system) => {
      if (system.userData.model && system.userData.model.id === id) {
        system.userData.model.setOpened(isOpen);
        this.populateScene();
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
    nodegroups.forEach((nodegroup) => {
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
    // Get model of application of the store
    let emberModel = this.get('store').peekRecord('application', id);
   
    // Do not allow to have the same app opened twice
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
    // Apply rotattion
    this.get('vrEnvironment').rotation.x += delta.x;
    this.get('vrEnvironment').rotation.y += delta.y;
    this.get('vrEnvironment').rotation.z += delta.z;
    this.updateObjectMatrix(this.get('vrEnvironment'));

    // Synchronize rotation with other users
    this.get('interaction').trigger('centerVREnvironment');
    this.get('interaction').trigger('landscapeMoved', new THREE.Vector3(0, 0, 0));
  },

  switchHand() {
    Menus.removeAll();
    let oldMenuController = this.get('userIsLefty') ? this.get('controller2') : this.get('controller1');
    let oldOtherController = this.get('userIsLefty') ? this.get('controller1') : this.get('controller2');
    if (oldMenuController.getObjectByName('textBox')) {
      oldMenuController.remove(oldMenuController.getObjectByName('textBox'));
    }
    this.set('userIsLefty', !this.get('userIsLefty'));
    this.get('interaction').removeControllerHandlers();
    this.set('interaction.primaryController', oldMenuController);
    this.set('interaction.secondaryController', oldOtherController);
    this.get('interaction').addControllerHandlers();
    oldMenuController.getObjectByName('controllerLine').material.color = new THREE.Color('rgb(0,204,51)');
    oldOtherController.getObjectByName('controllerLine').material.color = new THREE.Color('rgb(0,0,0)');
    this.get('advancedMenu').open(this.get('optionsMenu'), this);
  },

  sendControllerUpdate() {
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
      //if status of at least one controller has changed, inform backend
      if((disconnect && disconnect.length > 0) || connect) {
        this.get('sender').sendControllerUpdate(connect, disconnect);
      }
    }
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

  // Called when user closes the site / tab
  willDestroyElement() {
    this._super(...arguments);

    this.set('running', false);
    this.disconnect(true);
    this.set('userID', null);
    this.set('state', null);
    this.set('lastPositions', null);
    this.set('controllersConnected', null);
    this.set('lastTime', null);
    this.set('deltaTime', null);
    this.set('running', null);
    this.set('spectatedUser', null);
    this.set('startPosition', null);

    // Exit presentation on HMD
    if (navigator.getVRDisplays) {
      navigator.getVRDisplays().then((displays) => {
        if (displays.length > 0 && displays[0].isPresenting)
          displays[0].exitPresent();
      });
    }
  },

});
