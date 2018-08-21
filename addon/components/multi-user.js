import { inject as service } from '@ember/service';
import User from '../utils/multi-user/user';
import Helper from '../utils/multi-user/helper';
import Sender from '../utils/multi-user/send';
import VRRendering from './vr-rendering';
import Ember from 'ember';
import THREE from 'three';
import UserListMenu from '../utils/multi-user/menus/user-list-menu';
import OptionsMenu from '../utils/multi-user/menus/options-menu';
import SpectateMenu from '../utils/multi-user/menus/spectate-menu';
import LandscapePositionMenu from '../utils/multi-user/menus/landscape-position-menu';
import CameraHeightMenu from '../utils/multi-user/menus/camera-height-menu';
import MessageBox from '../utils/multi-user/menus/message-box-menu';


//Declare globals
/*global createOBJLoader*/

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
  userID: null, // own userID
  state: null, // own connection status, state in {'connecting', 'connected', 'spectating'}
  lastPositions: null, // last positions of camera and controllers
  controllersConnected: null, // tells which controller(s) are connected
  fps: 90, // tells how many pictures are max. rendered per second (refresh rate of Vive/Rift is 90)
  lastTime: null, // last time an image was rendered
  currentTime: null, // tells the current time in ms
  deltaTime: null, // time between two frames
  updateQueue: null, // messages which are ready to be sent to backend
  running: null, // tells if gameLoop is executing
  hmdObject: null, // object for other user's hmd
  spectatedUser: null, // tells which userID (if any) is being spectated
  menus: null, // keeps track of menus for settings
  startPosition: null, //position before this user starts spectating
  session: service(), //session used to retrieve username


  gameLoop() {
    if(!this.running) {
      return;
    }

    this.currentTime = new Date().getTime();

    //time difference between now and the last time updates were sent
    this.deltaTime = this.currentTime - this.lastTime;

    //if time difference is large enough, update and send messages to backend
    if(this.deltaTime > 1000/this.fps) {
      if(this.userID && this.state === 'connected') {
        this.update();
      } else if(this.userID && this.state === 'spectating') {
        this.spectateUser(); // follow view of spectated user
      }

      this.updateControllers();
      this.updateUserNameTags();
      this.render2();

      //send messages like connecting request, position updates etc.
      this.sendUpdates();

      this.lastTime = this.currentTime;
    }
    requestAnimationFrame(this.gameLoop.bind(this));
  },

  updateUserNameTags() {
    let users = this.users.values();
    let pos = new THREE.Vector3();
    this.camera.getWorldPosition(pos);
    for(let user of users) {
      if(user.state === 'connected') {
        user.namePlane.position.setFromMatrixPosition( user.camera.model.getObjectByName('dummyPlaneName').matrixWorld );
        user.namePlane.lookAt(pos);
        user.namePlane.updateMatrix();
      }
    }
  },

  spectateUser(){
    if (this.get('spectatedUser') === null || !this.get('users').get(this.get('spectatedUser'))){
      this.deactivateSpectating();
      return;
    }

    let spectatedUser = this.get('users').get(this.get('spectatedUser'));
    let position = spectatedUser.camera.position;

    const cameraOffset = new THREE.Vector3();
    
    cameraOffset.copy(this.camera.position);
    this.user.position.subVectors(new THREE.Vector3(position.x, position.y, position.z), cameraOffset); 
  },

  /**
   * Switches user into spectator mode
   * @param {Number} userID The id of the user to be spectated
   */
  activateSpectating(userID){
    if(this.get('state') === 'spectating'){
      this.deactivateSpectating();
    }

    if(!this.get('users').has(userID)){
      return;
    }
    console.log("Spectating user: " + userID);
    this.set('startPosition', this.user.position.clone());
    this.set('spectatedUser', userID);
    let spectatedUser = this.get('users').get(userID);

    //other user's hmd should be invisible
    spectatedUser.camera.model.visible = false;
    spectatedUser.namePlane.visible = false;
    this.set('state', 'spectating');
    Sender.sendSpectatingUpdate.call(this);
  },

  deactivateSpectating(){
    if(!this.spectatedUser)
      return;
    
    let spectatedUser = this.get('users').get(this.get('spectatedUser'));
    spectatedUser.camera.model.visible = true;
    spectatedUser.namePlane.visible = true;
    this.set('state', 'connected');
    this.set('spectatedUser', null);

    SpectateMenu.updateText('spectating_user', 'Spectating no-one');

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
    this.loadHMDModel();

    const self = this;

    this.set('currentTime', 0);
    this.set('deltaTime', 0);
    this.set('updateQueue', []);
    this.set('running', false);
    this.set('menus', new Map());
    this.set('users', new Map());
    this.set('lastPositions', { camera: null, controller1: null, controller2: null });
    this.set('controllersConnected', { controller1: false, controller2: false });
    this.set('lastTime', new Date().getTime());

    let old_checkIntersectionRightController = this.get('interaction').checkIntersectionRightController;
    this.get('interaction').checkIntersectionRightController = function() {
      let menus = [];
      self.menus.forEach((menu) => {
        menus.push(menu.mesh);
      });
      let menuHit = self.checkIntersectionRightController(menus);
      if(menuHit) {
        // Unhighlight delete button
        this.unhighlightedDeleteButton(self.controller2.id, true);
        // Restore old color of landscape
        this.unhighlightLandscape(self.controller2.id);
        // Restore old color of application3D
        this.unhighlightApplication3D(self.controller2.id);
      } else {
        if(self.state !== 'spectating')
          old_checkIntersectionRightController.apply(this);
        else
          self.get('controller2').getObjectByName('controllerLine').scale.z = self.zeroValue;
      }
    };
    
    let old_checkIntersectionLeftController = this.get('interaction').checkIntersectionLeftController;
    this.get('interaction').checkIntersectionLeftController = function() {
      if(self.state !== 'spectating')
        old_checkIntersectionLeftController.apply(this);
      else
        self.get('controller1').getObjectByName('controllerLine').scale.z = self.zeroValue;
    };

    let old_onTriggerDownController2 = this.get('interaction').onTriggerDownController2;
    this.get('interaction').onTriggerDownController2 = function(event) {
      let menus = [];
      self.menus.forEach((menu) => {
        menus.push(menu.mesh);
      });
      let menuHit = self.onTriggerDownController2(menus);
      if(!menuHit) {
        if(self.state !== 'spectating')
          old_onTriggerDownController2.apply(this, [event]);
      }
    };

    let old_onTriggerDownController1 = this.get('interaction').onTriggerDownController1;
    this.get('interaction').onTriggerDownController1 = function(event) {
      if(self.state !== 'spectating')
        old_onTriggerDownController1.apply(this, [event]);
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

    let old_onGripUpController1 = this.get('interaction').onGripUpController1;
    this.get('interaction').onGripUpController1 = function(event) {
      self.onGripUpController1();
      old_onGripUpController1.apply(this, [event]);
    };

    let host, port;
    Ember.$.getJSON("config/config_multiuser.json").then(json => {
      console.log("Read JSON");
      host = json.host;
      port = json.port;

      if(!host || !port) {
        console.log('Config not found');
        return;
      }

      console.log("Open Socket");
      const socket = this.websockets.socketFor(`ws://${host}:${port}/`);
      socket.on('open', this.openHandler, this);
      socket.on('message', this.messageHandler, this);
      socket.on('close', this.closeHandler, this);

      this.set('socketRef', socket);
      console.log("Start gameLoop");
      this.running = true;
      this.gameLoop();
    });

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
   * Check wether there are messages in the queue and send those to backend
   */
  sendUpdates() {
    //there are updates to send
    if(this.updateQueue.length > 0) {
      this.send(this.updateQueue);
      this.set('updateQueue', []);
    }
  },

  checkIntersectionRightController(objects) {
    let controller = this.get('controller2');
    let controllerLine = controller.getObjectByName('controllerLine');

    var tempMatrix = new THREE.Matrix4();

    // Calculate controller direction and origin
    tempMatrix.identity().extractRotation( controllerLine.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controllerLine.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, objects);
    
    if(intersectedViewObj) {
      controllerLine.scale.z = intersectedViewObj.distance;
      let name = intersectedViewObj.object.name;
      let menu = this.menus.get(name);
      if(menu) {
        menu.interact('rightIntersect', intersectedViewObj.uv);
        return true;
      }
    }
  },

  onTriggerDownController2(objects) {
    let controller = this.get('controller2');
    let controllerLine = controller.getObjectByName('controllerLine');

    var tempMatrix = new THREE.Matrix4();

    // Calculate controller direction and origin
    tempMatrix.identity().extractRotation( controllerLine.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controllerLine.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, objects);
    
    if(intersectedViewObj) {
      controllerLine.scale.z = intersectedViewObj.distance;
      let name = intersectedViewObj.object.name;
      let menu = this.menus.get(name);
      if(menu) {
        menu.interact('rightTrigger', intersectedViewObj.uv);
        return true;
      }
    }
  },

  onMenuDownController1() {
    if(this.state !== 'spectating') {
      if(OptionsMenu.isOpen())
        OptionsMenu.close.call(this);
      else if(CameraHeightMenu.isOpen())
        CameraHeightMenu.back.call(this);
      else if(LandscapePositionMenu.isOpen())
        LandscapePositionMenu.back.call(this);
      else if(SpectateMenu.isOpen())
        SpectateMenu.back.call(this);
      else
        OptionsMenu.open.call(this);
    } else {
      this.deactivateSpectating();
      SpectateMenu.back.call(this);
    }
  },

  onGripDownController1() {
    UserListMenu.open.call(this);
  },

  onGripUpController1() {
    UserListMenu.close.call(this);
  },

  /**
   * Load the Texture for the hmds of other users
   */
  loadHMDModel() {
    let OBJLoader = createOBJLoader(THREE);
    let loader = new OBJLoader(THREE.DefaultLoadingManager);
    // Load HMD Model
    loader.setPath('generic_hmd/');
    loader.load('generic_hmd.obj', object => {
      const obj = object;
      obj.name = "hmdTexture";
      let loader = new THREE.TextureLoader();
      loader.setPath('generic_hmd/');
      obj.children[0].material.map = loader.load('generic_hmd.tga');
      this.set('hmdObject', obj);
    });
  },

  /**
   * Update position data and data on controller connections
   */
  update() {
    this.updateAndSendPositions();
    Sender.sendControllerUpdate.call(this);
  },

  updateAndSendPositions() {
    if(this.camera && this.user && !this.lastPositions.camera) {
      const pos = new THREE.Vector3();
      pos.add(this.user.position);
      pos.add(this.camera.position);
      this.lastPositions.camera = pos.toArray();
    }
    if(this.controller1 && !this.lastPositions.controller1) {
      const pos = new THREE.Vector3();
      pos.add(this.user.position);
      pos.add(this.controller1.position);
      this.lastPositions.controller1 = pos.toArray();
    }
    if(this.controller2 && !this.lastPositions.controller2) {
      const pos = new THREE.Vector3();
      pos.add(this.user.position);
      pos.add(this.controller2.position);
      this.lastPositions.controller2 = pos.toArray();
    }

    let positionObj = {
      "event": "receive_user_positions",
      "time": Date.now()
    };

    const posCamera = new THREE.Vector3();
    posCamera.add(this.user.position);
    posCamera.add(this.camera.position);

    const posController1 = new THREE.Vector3();
    posController1.add(this.user.position);
    posController1.add(this.controller1.position);

    const posController2 = new THREE.Vector3();
    posController2.add(this.user.position);
    posController2.add(this.controller2.position);

    let currentPositions = {
      controller1: posController1.toArray(),
      controller2: posController2.toArray(),
      camera: posCamera.toArray()
    }

    let hasChanged = false;

    if(JSON.stringify(currentPositions.controller1) !== JSON.stringify(this.lastPositions.controller1)) {
      hasChanged = true;
      positionObj.controller1 = {
        "position": currentPositions.controller1,
        "quaternion": this.controller1.quaternion.toArray()
      };
    }
    if(JSON.stringify(currentPositions.controller2) !== JSON.stringify(this.lastPositions.controller2)) {
      hasChanged = true;
      positionObj.controller2 = {
        "position": currentPositions.controller2,
        "quaternion": this.controller2.quaternion.toArray()
      };
    }
    if(JSON.stringify(currentPositions.camera) !== JSON.stringify(this.lastPositions.camera)) {
      hasChanged = true;
      positionObj.camera = {
        "position": currentPositions.camera,
        "quaternion": this.camera.quaternion.toArray()
      };
    }

    if(hasChanged) {
      this.lastPositions = currentPositions;
      this.updateQueue.push(positionObj);
    }
  },

  /**
   * Inform the backend that user leaves the session
   */
  disconnect() {
    const disconnectMessage = [{
      "event": "receive_disconnect_request"
    }];
    this.send(disconnectMessage);
  },


  /**
   * Handles all incoming messages of the backend and delegates data to
   * the corresponding function
   * @param {JSON} event Event of websocket containing all messages of backend
   */
  messageHandler(event) {
    //backend could have sent multiple messages at a time
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
          break;
      }
    }
  },

  /**
   * After socket has opened to backend client is told his/her userID.
   * Respond by asking for "connected" status.
   * @param {JSON} data Message containing own userID
   */
  onSelfConnecting(data) {
    //if name is not found, use id as default name
    let name = this.get('session.data.authenticated.username') ? this.get('session.data.authenticated.username') : "ID: " + data.id;
    this.set('userID', data.id);
    let JSONObj = {
      "event": "receive_connect_request",
      "name": name
    };
    this.updateQueue.push(JSONObj);
  },

  onSelfConnected(data) {
    // create User model for all users and add them to the users map
    for (let i = 0; i < data.users.length; i++) {
      const userData = data.users[i];
      let user = new User();
      user.set('name', userData.name);
      user.set('id', userData.id);
      user.set('color', userData.color);
      user.set('state', 'connected');
      console.log(user);

      if(userData.controllers.controller1) {
        if(userData.controllers.controller1 === 'Oculus Touch (Left)') {
          user.initController1(userData.controllers.controller1, this.get('oculusLeftControllerObject').clone());
        } else if(userData.controllers.controller1 === 'Oculus Touch (Right)') {
          user.initController1(userData.controllers.controller1, this.get('oculusRightControllerObject').clone());
        } else {
          user.initController1(userData.controllers.controller1, this.get('viveControllerObject').clone());
        }

        this.get('scene').add(user.get('controller1.model'));
        this.addLineToControllerModel(user.controller1, user.color);
      }

      if(userData.controllers.controller2) {
        if(userData.controllers.controller2 === 'Oculus Touch (Right)') {
          user.initController2(userData.controllers.controller2, this.get('oculusRightControllerObject').clone());
        } else if (userData.controllers.controller2 === 'Oculus Touch (Left)') {
          user.initController2(userData.controllers.controller2, this.get('oculusLeftControllerObject').clone());
        } else {
          user.initController2(userData.controllers.controller2, this.get('viveControllerObject').clone());
        }

        this.get('scene').add(user.get('controller2.model'));
        this.addLineToControllerModel(user.controller2, user.color);
      }

      user.initCamera(this.get('hmdObject').clone());
      //add models for other users
      this.get('scene').add(user.get('camera.model'));

      this.get('users').set(userData.id, user);

      //set name for user on top of his hmd 
      this.addUsername(userData.id);
    }
    this.state = "connected";
  },

  onUserConnected(data) {
    let user = new User();
    user.set('name', data.user.name);
    user.set('id', data.user.id);
    user.set('color', data.user.color);
    user.set('state', 'connected');
    console.log(user);
    user.initCamera(this.get('hmdObject').clone());
    this.get('users').set(data.user.id, user);

    //add model for new user
    this.get('scene').add(user.get('camera.model'));

    this.addUsername(data.user.id);

    MessageBox.enqueueMessage.call(this, {title: 'User connected', text: user.get('name'), color: Helper.rgbToHex(user.get('color'))}, 3000);

  },

  onUserDisconnect(data) {
    let { id } = data;

    //do not spectate a disconnected user
    if (this.get('state') === 'spectating' && this.get('spectatedUser') === id) {
      this.deactivateSpectating();
    }


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

  onUserControllers(data) {
    let { id, disconnect, connect } = data;

    if(!this.get('users').has(id))
      return;

    let user = this.get('users').get(id);
    if(connect) {
      if(connect.controller1) {
        if(connect.controller1 === 'Oculus Touch (Left)') {
            user.initController1(connect.controller1, this.get('oculusLeftControllerObject').clone());
        } else if(connect.controller1 === 'Oculus Touch (Right)') {
            user.initController1(connect.controller1, this.get('oculusRightControllerObject').clone());
        } else {
            user.initController1(connect.controller1, this.get('viveControllerObject').clone());
        }
        this.addLineToControllerModel(user.controller1, user.color);
        console.log("Controller1 line added");
        this.get('scene').add(user.get('controller1.model'));
        console.log("Controller1 connected");

      }
      if(connect.controller2) {
        if(connect.controller2 === 'Oculus Touch (Right)') {
            user.initController2(connect.controller2, this.get('oculusRightControllerObject').clone());
        } else if(connect.controller2 === 'Oculus Touch (Left)') {
            user.initController2(connect.controller2, this.get('oculusLeftControllerObject').clone());
        } else {
            user.initController2(connect.controller2, this.get('viveControllerObject').clone());
        }
        this.addLineToControllerModel(user.controller2, user.color);
        console.log("Controller2 line added");
        this.get('scene').add(user.get('controller2.model'));
        console.log("Controller2 connected");
      }
    }
    if(disconnect) {
      for (let i = 0; i < disconnect.length; i++) {
        const controller = disconnect[i];
        if(controller === 'controller1') {
          console.log("Controller1 disconnected");
          this.get('scene').remove(user.get('controller1.model'));
          user.removeController1();
        }
        if(controller === 'controller2') {
          console.log("Controller2 disconnected");
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
      let position = data.landscape.position;
      console.log("Initial position offset: " + position);
      let quaternion = data.landscape.quaternion;
      console.log("Initial quaternion: " + quaternion);
      this.onLandscapePosition(position, quaternion);
    }
  },

  onLandscapePosition(deltaPosition, quaternion){
    this.get('environmentOffset').x += deltaPosition[0];
    this.get('environmentOffset').z += deltaPosition[2];

    this.get('vrEnvironment').position.x += deltaPosition[0];
    this.get('vrEnvironment').position.y += deltaPosition[1];
    this.get('vrEnvironment').position.z += deltaPosition[2];

    this.get('vrEnvironment').quaternion.fromArray(quaternion);

    this.updateObjectMatrix(this.get('vrEnvironment'));
    this.centerVREnvironment(this.get('vrEnvironment'), this.get('room'));
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
      controller = this.get('users').get(userID).get('controller1').model;
    } else {
      controller = this.get('users').get(userID).get('controller2').model;
    }

    controller.position.fromArray(controllerPosition);
    controller.quaternion.fromArray(controllerQuaternion);

    // Add object to controller
    controller.add(app);
    // Store object 
    controller.userData.selected = app; 

  },

  onSpectatingUpdate(userID, isSpectating) {
    let user = this.get('users').get(userID);
    if (isSpectating) {
      user.state = 'spectating';
      user.setVisible(false);
      if(this.state === 'spectating' && this.spectatedUser === userID) {
        this.deactivateSpectating();
      }
    } else {
      user.state = 'connected';
      user.setVisible(true);
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

    //save highlighted entity
    if (isHighlighted){
      this.onHighlightingUpdate(userID, false);
      user.setHighlightedEntity(appID, entityID, originalColor);
    //restore highlighted entity data
    } else {
      appID = user.highlightedEntity.appID;
      entityID = user.highlightedEntity.entityID;
      originalColor = user.highlightedEntity.originalColor;
    }

    let app = this.get('openApps').get(appID);

    //return if app is not opened
    if(!app){
      return;
    }

    //find component/clazz which shall be highlighted
    app.children.forEach( child => {
      if (child.userData.model && child.userData.model.id === entityID){

        let hsl = new Object();
        child.material.emissive.getHSL(hsl);

        if (isHighlighted){
          let colorArray = user.get('color');
          let userColor = new THREE.Color(colorArray[0]/255.0, colorArray[1]/255.0, colorArray[2]/255.0);
          child.material.color = new THREE.Color(userColor);
          //darken the color (same is done for HMDs)
          child.material.emissive.setHSL(hsl.h, hsl.s, 0.1);
        } else {
          child.material.color = new THREE.Color(originalColor);
          //lighten color up again
          child.material.emissive.setHSL(hsl.h, hsl.s, 0);
        }
        return;
      }
    });
  },

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

    //width according to textsize, will be automatically resized to a power of two
    let width = textSize.width * 3 + 20;
    let height = textSize.height * 5;

    // use canvas to display text
    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = width;
    this.get('canvas2').height = height;
    let canvas2 = this.get('canvas2');
    var ctx = canvas2.getContext('2d');
    ctx.fillStyle = 'rgba(200, 200, 216, 0.5)'; // light grey
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);


    ctx.font = `30px arial`;
    ctx.fillStyle = Helper.rgbToHex(user.get('color')); // username is colored in corresponding color
    ctx.textAlign = 'center';
    ctx.fillText(username, canvas2.width / 2, 35);
       
    // create texture out of canvas
    let texture = new THREE.Texture(canvas2);

    // Update texture      
    texture.needsUpdate = true;

    let geometry = new THREE.PlaneGeometry(width / 500, height / 500, 32 );
    let material = new THREE.MeshBasicMaterial( {map: texture, color: 0xffffff, side: THREE.DoubleSide} );
    material.transparent = true;
    material.opacity = 0.8; //make username tag slightly transparent
    let plane = new THREE.Mesh( geometry, material );

    //use dummy object to let username always face camera with lookAt() function
    let dummy = new THREE.Object3D();
    dummy.name = 'dummyPlaneName';

    dummy.position.x = camera.position.x;
    dummy.position.y = camera.position.y + 0.3; //display username above hmd
    dummy.position.z = camera.position.z;

    user.namePlane = plane;

    //username moves with user
    camera.add(dummy);
    this.scene.add(plane);
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
    // set system status to opened / closed
    let vrLandscape = this.get('vrLandscape').children;
    systems.forEach(system => {
      let emberModel = this.get('store').peekRecord('system', system.id);
      emberModel.setOpened(system.opened);
    });
    this.populateScene();

    // use of store like above currently not possible, due to problems with klay
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

    //get model of application of the store
    let emberModel = this.get('store').peekRecord('application', id);
   
    //dont allow to have the same app opened twice
    if (this.get('openApps').has(emberModel.id)){
      return;
    }

    //note that this property is still only working for one app at a time
    this.set('landscapeRepo.latestApplication', emberModel); 
    //position and quaternion where the application shall be displayed
    let position = new THREE.Vector3().fromArray(posArray);
    let quaternion = new THREE.Quaternion().fromArray(quatArray);
    // Add 3D Application to scene (also if another one exists already)
    this.add3DApplicationToLandscape(emberModel, position, quaternion);

    //update matrix to display application correctly in the world
    this.get('openApps').get(emberModel.id).updateMatrix();
  },

  /**
   * Move landscape in x or z direction
   */
  moveLandscape(delta) {
    let scaledDeltaX = (delta.x / -100.0);
    let scaledDeltaY = (delta.y / 100.0);

    this.get('environmentOffset').x += scaledDeltaX;
    this.get('environmentOffset').z -= scaledDeltaY;

    this.get('vrEnvironment').position.x +=  scaledDeltaX;
    this.get('vrEnvironment').position.z -= scaledDeltaY;
    this.updateObjectMatrix(this.get('vrEnvironment'));

    let deltaPosition = new THREE.Vector3(scaledDeltaX, 0, scaledDeltaY);
    this.get('interaction').trigger('landscapeMoved', deltaPosition);
  },

  /*
   *  This method is used to update the matrix of
   *  a given Object3D
   */
  updateObjectMatrix(object){
    if(object){
      object.updateMatrix();
    }
  },

  //called when the websocket is opened for the first time
  openHandler(event) {
    console.log(`On open event has been called: ${event}`);
  },

  //used to send messages to the backend
  send(obj) {
    // console.log(`Sending: ${JSON.stringify(obj)}`);
    this.socketRef.send(JSON.stringify(obj));
  },

  //called when the websocket is closed
  closeHandler(event) {
    console.log(`On close event has been called: ${event}`);
  },

  //called when user closes the site / tab
  willDestroyElement() {
    console.log("Destroy");
    this._super(...arguments);

    this.running = false;
    this.disconnect();
    const socket = this.socketRef;
    if(socket) {
      socket.off('open', this.myOpenHandler);
      socket.off('message', this.myMessageHandler);
      socket.off('close', this.myCloseHandler);
    }
    this.socketRef = null,
    this.users = null;
    this.userID = null;
    this.state = null;
    this.lastPositions = null;
    this.controllersConnected = null;
    this.lastTime = null;
    this.currentTime = null;
    this.deltaTime = null;
    this.running = null;
    this.updateQueue = null;
    this.hmdObject = null;
    this.spectatedUser = null;
    this.menus = null;
    this.startPosition = null;
    this.websockets = null;
    this.session = null;
  },

});
