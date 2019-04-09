import { inject as service } from '@ember/service';
import Evented from '@ember/object/evented';
import THREE from 'three';
import $ from 'jquery';
import Models from '../utils/models';
import Helper from '../utils/multi-user/helper';
import VRRendering from './vr-rendering';
import AlertifyHandler from 'explorviz-frontend/mixins/alertify-handler';


/**
 * This component extends the functionalities of vr-rendering so that multiple users
 * can use the vr-mode of ExplorViz. In its core a websocket with a tcp connection 
 * to the backend is used to send and receive updates about the landscape, applications and
 * other users.
 *
 * @class MULTI-USER
 * @extends vr-rendering
 */
export default VRRendering.extend(Evented, AlertifyHandler, {

  tagName: '',

  menus: service(), // Allows to add, get & remove menus
  sender: service(), // Sends JSON update messages to backend
  session: service(), // Session used to retrieve username
  spectating: service(), // Allows to activate and deactivate spectating mode
  store: service(),
  time: service(), // Keeps track of elapsed time between frames etc.
  currentUser: service('user'), // Keeps track of key properties about user (e.g. connection state)
  webSocket: service(), // Allows communication with backend extension
  connection: service(),
  
  running: null, // Tells if main loop is executing
  lastPositions: null, // Last positions of camera and controllers

  /**
   * Main loop contains all methods which need to be called
   * for every rendering iteration
   */
  mainLoop() {
    if(!this.get('running')) {
      return;
    }

    this.get('time').update();

    let userID = this.get('currentUser.userID');
    let state = this.get('currentUser.state');

    if(userID && state === 'spectating') {
      this.get('spectating').update(); // Follow view of spectated user
    }

    // Handle own controller updates and ray intersections
    this.updateControllers();

    // Move name tags to right position and rotate them toward our camera
    if(userID && (state === 'connected' || state === 'spectating'))
      this.updateUserNameTags();

    // Render scene
    this.renderScene();

    // Add controller / camera updates (position changes, controller disconnect etc.)
    if(userID && (state === 'connected' || state === 'spectating')) {
      this.update();
    } 

    // Actually send messages like connecting request, position updates etc.
    if(state !== 'offline')
      this.get('webSocket').sendUpdates();
  },

  /**
   * Main rendering method.
   */
  renderScene() {
    this.get('threexStats').update(this.get('webglrenderer'));
    this.get('stats').begin();
    this.get('webglrenderer').render(this.get('world.scene'), this.get('currentUser.camera'));
    this.get('stats').end();
  },

  /**
   * Set user name tag to be directly above their head
   * and set rotation such that it looks toward our camera.
   */
  updateUserNameTags() {
    let users = this.get('store').peekAll('vr-user');
    let pos = new THREE.Vector3();
    this.get('currentUser.camera').getWorldPosition(pos);

    users.forEach((user) => {
      if (user.get('state') === 'connected' && user.get('namePlane')) {
        user.get('namePlane.position').setFromMatrixPosition(user.get('camera.model').getObjectByName('dummyPlaneName').matrixWorld);
        user.get('namePlane').lookAt(pos);
        user.get('namePlane').updateMatrix();
      }
    });
  },

  /**
   * Called once when the site has loaded.
   */
  didRender() {
    this._super(...arguments);

    this.initVariables();
    this.initInteractions();
    this.initListeners();

    let host, port;
    $.getJSON('config/config_multiuser.json').then(json => {
      host = json.host;
      port = json.port;

      if(!host || !port) {
        this.showAlertifyError('Config not found');
      }

      this.set('webSocket.host', host);
      this.set('webSocket.port', port);

      this.get('menus.connectMenu').open(this.get('menus.optionsMenu'));
      this.set('running', true);
      this.get('webglrenderer').setAnimationLoop(this.mainLoop.bind(this));
    });
  },

  /**
   * Initiates properties with default values.
   */
  initVariables() {
    this.set('running', false);
    this.set('lastPositions', { camera: null, controller1: null, controller2: null });
  },

  initInteractions() {
    const self = this;
    
    // Override actions to prevent users in spectator mode from interacting with landscape, apps or teleport

    let old_checkIntersectionPrimaryController = this.get('world.interaction').checkIntersectionPrimaryController;
    this.get('world.interaction').checkIntersectionPrimaryController = function() {
      if(self.get('currentUser.state') !== 'spectating')
        old_checkIntersectionPrimaryController.apply(this, [this.get('raycastObjectsLandscape').concat(this.get('menus').getVisibleMenuMeshesArray())]);
      else {
        old_checkIntersectionPrimaryController.apply(this, [this.get('menus').getVisibleMenuMeshesArray()]);
      }
    };
    
    let old_checkIntersectionSecondaryController = this.get('world.interaction').checkIntersectionSecondaryController;
    this.get('world.interaction').checkIntersectionSecondaryController = function() {
      if(self.get('currentUser.state') !== 'spectating')
        old_checkIntersectionSecondaryController.apply(this, [this.excludeLandscape().concat(this.get('menus').getVisibleMenuMeshesArray())]);
      else
        self.get('currentUser.controller1').getObjectByName('controllerLine').scale.z = self.zeroValue;
    };

    let old_onTriggerDownPrimaryController = this.get('world.interaction').onTriggerDownPrimaryController;
    this.get('world.interaction').onTriggerDownPrimaryController = function(event) {
      if(self.get('currentUser.state') !== 'spectating')
        old_onTriggerDownPrimaryController.apply(this, [event, this.get('raycastObjectsLandscape').concat(this.get('menus').getVisibleMenuMeshesArray())]);
      else
        old_onTriggerDownPrimaryController.apply(this, [event, this.get('menus').getVisibleMenuMeshesArray()]);
    };

    let old_onTriggerDownSecondaryController = this.get('world.interaction').onTriggerDownSecondaryController;
    this.get('world.interaction').onTriggerDownSecondaryController = function(event) {
      if(self.get('currentUser.state') !== 'spectating')
      old_onTriggerDownSecondaryController.apply(this, [event, this.excludeLandscape().concat(this.get('menus').getVisibleMenuMeshesArray())]);
      else
        self.get('currentUser.controller1').getObjectByName('controllerLine').scale.z = self.zeroValue;
    };

    let old_onMenuDownSecondaryController= this.get('world.interaction').onMenuDownSecondaryController;
    this.get('world.interaction').onMenuDownSecondaryController = function(event) {
      self.onMenuDownSecondaryController();
      old_onMenuDownSecondaryController.apply(this, [event]);
    };

    let old_onGripDownSecondaryController = this.get('world.interaction').onGripDownSecondaryController;
    this.get('world.interaction').onGripDownSecondaryController = function(event) {
      self.onGripDownSecondaryController();
      old_onGripDownSecondaryController.apply(this, [event]);
    };

    let old_onGripDownPrimaryController = this.get('world.interaction').onGripDownPrimaryController;
    this.get('world.interaction').onGripDownPrimaryController = function(event) {
      if(self.get('currentUser.state') !== 'spectating')
        old_onGripDownPrimaryController.apply(this, [event]);
    };

    let old_onGripUpSecondaryController = this.get('world.interaction').onGripUpSecondaryController;
    this.get('world.interaction').onGripUpSecondaryController = function(event) {
      self.onGripUpSecondaryController();
      old_onGripUpSecondaryController.apply(this, [event]);
    };

// Initialize interaction events and delegate them to the corresponding functions
    this.get('world.interaction').on('systemStateChanged', (id, isOpen) => {
      this.get('sender').sendSystemUpdate(id, isOpen);
    });
    this.get('world.interaction').on('nodegroupStateChanged', (id, isOpen) => {
      this.get('sender').sendNodegroupUpdate(id, isOpen);
    });
    this.on('applicationOpened', (id, app) => {
      this.get('sender').sendAppOpened(id, app);
    });
    this.get('world.interaction').on('removeApplication',(appID) => {
      this.get('sender').sendAppClosed(appID);
    });
    this.get('world.interaction').on('appReleased',(appID, position, quaternion) => {
      this.get('sender').sendAppReleased(appID, position, quaternion);
    });
    this.get('world.interaction').on('appBinded',(appID, appPosition, appQuaternion, isBoundToSecondaryController, controllerPosition, controllerQuaternion) => {
      this.get('sender').sendAppBinded(appID, appPosition, appQuaternion, isBoundToSecondaryController, controllerPosition, controllerQuaternion);
    });
    this.get('world.interaction').on('componentUpdate', (appID , componentID, isOpened, isFoundation) => {
      this.get('sender').sendComponentUpdate(appID, componentID, isOpened, isFoundation);
    });
    this.get('world.interaction').on('landscapeMoved', (deltaPosition) => {
      this.get('sender').sendLandscapeUpdate(deltaPosition, this.get('world.vrEnvironment'), this.get('world.environmentOffset'));
    });
    this.get('world.interaction').on('entityHighlighted', (isHighlighted, appID, entityID, color) => {
      this.get('sender').sendHighlightingUpdate(this.get('currentUser.userID'), isHighlighted, appID, entityID, color);
    });
  },

  /**
   * Handles menu-down controller iteraction.
   */
  onMenuDownSecondaryController() {
    // Open options menu if no other menu is open
    // Else closes current menu or goes back one menu if possible.
    if (this.get('currentUser.state') !== 'spectating') {
      if (this.get('menus.optionsMenu').isOpen())
        this.get('menus.optionsMenu').close();
      else if (this.get('menus.cameraHeightMenu').isOpen())
        this.get('menus.cameraHeightMenu').back();
      else if (this.get('menus.landscapePositionMenu').isOpen())
        this.get('menus.landscapePositionMenu').back();
      else if (this.get('menus.spectateMenu').isOpen())
        this.get('menus.spectateMenu').back();
      else if (this.get('menus.connectMenu').isOpen())
        this.get('menus.connectMenu').back();
      else if (this.get('menus.advancedMenu').isOpen())
        this.get('menus.advancedMenu').back();
      else
        this.get('menus.optionsMenu').open(null);
    } else {
      this.get('spectating').deactivate();
      this.get('menus.spectateMenu').back();
    }
  },

  /**
   * Handles grip-down controller iteraction.
   * Opens user list menu if online.
   */
  onGripDownSecondaryController() {
    if(this.get('currentUser.state') === 'connected' || this.get('currentUser.state') === 'spectating')
      this.get('menus.userListMenu').open();
    else
      this.get('menus.hintMenu').showHint('Cannot open the user list when offline!', 3);
  },

  /**
   * Handles grip-up controller iteraction.
   * Closes user list menu
   */
  onGripUpSecondaryController() {
    this.get('menus.userListMenu').close();
  },

  /**
   * Update position data and data on controller connections
   */
  update() {
    this.updateAndSendPositions();
    this.sendControllerUpdate();
  },

  /**
   * If changed, sends a message of new camera and controller positions and quaternions.
   */
  updateAndSendPositions() {
    // If no last positions exist, set them to current position of camera and controllers
    if(this.get('currentUser.camera') && this.get('currentUser.threeGroup') && !this.get('lastPositions.camera')) {
      const pos = new THREE.Vector3();
      this.get('currentUser.camera').getWorldPosition(pos);
      this.set('lastPositions.camera', pos.toArray());
    }
    if(this.get('currentUser.controller1') && !this.get('lastPositions.controller1')) {
      const pos = new THREE.Vector3();
      this.get('currentUser.controller1').getWorldPosition(pos);
      this.set('lastPositions.controller1', pos.toArray());
    }
    if(this.get('currentUser.controller2') && !this.get('lastPositions.controller2')) {
      const pos = new THREE.Vector3();
      this.get('currentUser.controller2').getWorldPosition(pos);
      this.set('lastPositions.controller2', pos.toArray());
    }

    let positionObj = {
      "event": "receive_user_positions",
      "time": Date.now()
    };

    // Get current camera and controller positions
    const posCamera = new THREE.Vector3();
    this.get('currentUser.camera').getWorldPosition(posCamera);

    const posSecondaryController = new THREE.Vector3();
    this.get('currentUser.controller1').getWorldPosition(posSecondaryController);

    const posController2 = new THREE.Vector3();
    this.get('currentUser.controller2').getWorldPosition(posController2);

    let currentPositions = {
      controller1: posSecondaryController.toArray(),
      controller2: posController2.toArray(),
      camera: posCamera.toArray()
    }

    // Use world quaternions because controller can also be rotated via controllerGroup
    let controller1Quaternion = new THREE.Quaternion();
    this.get('currentUser.controller1').getWorldQuaternion(controller1Quaternion);

    let controller2Quaternion = new THREE.Quaternion();
    this.get('currentUser.controller2').getWorldQuaternion(controller2Quaternion);

    let hasChanged = false;

    // If changed, add new positions and quaternions to message
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
        "quaternion": this.get('currentUser.camera.quaternion').toArray()
      };
    }

    // Send update if either position has changed
    if(hasChanged) {
      this.set('lastPositions', currentPositions);
      this.get('webSocket').enqueueIfOpen(positionObj);
    }
  },

  initListeners() {
    const socket = this.get('webSocket');

    socket.on('connection_closed', () => {
      if (this.get('currentUser.state') === 'connecting') {
        this.get('menus.hintMenu').showHint('Could not establish connection', 3);
      }
      this.get('connection').disconnect();
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
      this.get('world.scene').add(this.get('openApps').get(id));
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
  },

  /**
   * After socket has opened to backend client is told his/her userID.
   * Respond by asking for "connected" status.
   * 
   * @param {JSON} data Message containing own userID
   */
  onSelfConnecting(data) {
    // If name is not found, use id as default name
    let name = this.get('session.session.content.authenticated.user.username') || 'ID: ' + data.id;
    this.set('currentUser.userID', data.id);
    this.set('currentUser.color', data.color);
    this.get('world.interaction').set('highlightingColor', Helper.colorToString(data.color));

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
      this.get('world.scene').add(user.get('camera.model'));

      // Set name for user on top of his hmd 
      this.addUsername(userData.id);
    }
    this.set('currentUser.state', 'connected');
    this.set('currentUser.controllersConnected', { controller1: false, controller2: false });

    // Remove any open apps which may still exist from offline mode
    this.removeOpenApps();

    // Reset landscape position
    this.set('world.environmentOffset', new THREE.Vector3(0, 0, 0));
    this.get('world.vrEnvironment').rotation.x =  -1.5708;
    this.updateObjectMatrix(this.get('world.vrEnvironment'));
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

    this.get('world.scene').add(user.get('controller1.model'));
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

    this.get('world.scene').add(user.get('controller2.model'));
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

    // Add model for new user
    this.get('world.scene').add(user.get('camera.model'));

    this.addUsername(data.user.id);

    // Show connect notification
    this.get('menus.messageBox').enqueueMessage({title: 'User connected', text: user.get('name'), color: Helper.rgbToHex(user.get('color'))}, 3000);
  },

  /**
   * Removes the user that disconnected and informs our user about it.
   * 
   * @param {JSON} data - Contains the id of the user that disconnected.
   */
  onUserDisconnect(data) {
    let { id } = data;

    // Do not spectate a disconnected user
    if (this.get('currentUser.state') === 'spectating' && this.get('spectatedUser') === id) {
      this.get('spectating').deactivate();
    }
    // Removes user and their models.
    // Informs our user about their disconnect.
    let user = this.get('store').peekRecord('vr-user', id)
    if (user) {

      // Unhighlight possible objects of disconnected user
      this.onHighlightingUpdate(id, false, user.highlightedEntity.appID, user.highlightedEntity.entityID, user.highlightedEntity.originalColor);

      // Remove user's models
      this.get('world.scene').remove(user.get('controller1.model'));
      user.removeController1();
      this.get('world.scene').remove(user.get('controller2.model'));
      user.removeController2();
      this.get('world.scene').remove(user.get('camera.model'));
      user.removeCamera();

      // Remove user's name tag
      this.get('world.scene').remove(user.get('namePlane'));
      user.removeNamePlane();

      // Show disconnect notification
      this.get('menus.messageBox').enqueueMessage({ title: 'User disconnected', text: user.get('name'), color: Helper.rgbToHex(user.get('color')) }, 3000);
      this.get('store').unloadRecord(user);
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

    // Load newly connected controller(s)
    if(connect) {
      if(connect.controller1)
        this.loadController1(connect.controller1, user.get('id'));
      if(connect.controller2)
        this.loadController2(connect.controller2, user.get('id'));
    }

    // Remove controller model(s) due to controller disconnect
    if(disconnect) {
      for (let i = 0; i < disconnect.length; i++) {
        const controller = disconnect[i];
        if(controller === 'controller1') {
          this.get('world.scene').remove(user.get('controller1.model'));
          user.removeController1();
        } else if(controller === 'controller2') {
          this.get('world.scene').remove(user.get('controller2.model'));
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
      this.set('world.environmentOffset', new THREE.Vector3(0, 0, 0));
      let position = data.landscape.position;
      let quaternion = data.landscape.quaternion;
      this.onLandscapePosition(position, quaternion);
    }
  },

  onLandscapePosition(deltaPosition, quaternion){
    this.get('world.environmentOffset').x += deltaPosition[0];
    this.get('world.environmentOffset').y += deltaPosition[1];
    this.get('world.environmentOffset').z += deltaPosition[2];

    this.get('world.vrEnvironment').position.x += deltaPosition[0];
    this.get('world.vrEnvironment').position.y += deltaPosition[1];
    this.get('world.vrEnvironment').position.z += deltaPosition[2];

    this.get('world.vrEnvironment').quaternion.fromArray(quaternion);

    this.updateObjectMatrix(this.get('world.vrEnvironment'));
    this.get('world').centerVREnvironment();
    this.updateObjectMatrix(this.get('world.vrEnvironment'));
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
      user.set('currentUser.state', 'spectating');
      user.setVisible(false);
      if(this.get('currentUser.state') === 'spectating' && this.get('spectatedUser') === userID) {
        this.get('spectating').deactivate();
      } else {
        this.get('menus.messageBox').enqueueMessage({ title: user.get('name'), text: 'is now spectating'}, 2000);
      }
    } else {
      user.set('currentUser.state', 'connected');
      user.setVisible(true);
      this.get('menus.messageBox').enqueueMessage({ title: user.get('name'), text: 'is no longer spectating'}, 2000);
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
        user.highlightedEntity.originalColor); // Unhighlight possible old highlighting
      user.setHighlightedEntity(appID, entityID, originalColor); // Restore highlighted entity data
    }

    let app = this.get('openApps').get(appID);

    // Return if app is not opened
    if(!app){
      return;
    }

    // Apply higlighting
    app.children.forEach( child => {

      if (child.userData.model && child.userData.model.id === entityID){
        if(this.get('world.interaction.selectedEntitysMesh') === child && !isHighlighted){
          return;
        }

        if(this.get('world.interaction.selectedEntitysMesh') === child){
          this.get('world.interaction').set('selectedEntitysMesh', null);
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

    // Adapt length and position of ray and add to controller
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

    // Username moves with user (camera)
    camera.add(dummy);
    this.get('world.scene').add(plane);
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

  sendControllerUpdate() {
    let disconnect = [];
    let connect = {};

    let hasChanged = false;

    // Handle that controller 1 has disconnected
    if(this.get('currentUser.controllersConnected.controller1') && !this.get('currentUser.controller1').isConnected()) {
      disconnect.push('controller1');
      this.set('currentUser.controllersConnected.controller1', false);
      hasChanged = true;
    }
    // Handle that controller 1 has connected
    else if(!this.get('currentUser.controllersConnected.controller1') && this.get('currentUser.controller1').isConnected()) {
      connect.controller1 = this.get('currentUser.controller1').getGamepad().id;
      this.set('currentUser.controllersConnected.controller1', true);
      hasChanged = true;
    }

    // Handle that controller 2 has disconnected
    if(this.get('currentUser.controllersConnected.controller2') && !this.get('currentUser.controller2').isConnected()) {
      disconnect.push('controller2');
      this.set('currentUser.controllersConnected.controller2', false);
      hasChanged = true;
    }
    // Handle that controller 2 has connected
    else if(!this.get('currentUser.controllersConnected.controller2') && this.get('currentUser.controller2').isConnected()) {
      connect.controller2 = this.get('currentUser.controller2').getGamepad().id;
      this.set('currentUser.controllersConnected.controller2', true);
      hasChanged = true;
    }

    // Handle the case that either controller was connected/disconnected
    if(hasChanged) {
      // If status of at least one controller has changed, inform backend
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
    this.get('connection').disconnect();
    this.set('currentUser.userID', null);
    this.set('currentUser.state', null);
    this.set('currentUser.controllersConnected', null);
    this.set('running', null);
    this.set('lastPositions', null);
    this.set('spectating.spectatedUser', null);
    this.set('spectating.startPosition', null);

    // Exit presentation on HMD
    if (navigator.getVRDisplays) {
      navigator.getVRDisplays().then((displays) => {
        if (displays.length > 0 && displays[0].isPresenting)
          displays[0].exitPresent();
      });
    }
  },

});
