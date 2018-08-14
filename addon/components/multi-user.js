import { inject as service } from '@ember/service';
import EmberMap from '@ember/map';
import User from '../utils/multi-user/user';
import Menu from '../utils/multi-user/menu';
import VRRendering from './vr-rendering';
import Ember from 'ember';
import THREE from 'three';

/*global createOBJLoader*/

export default VRRendering.extend(Ember.Evented, {
  websockets: service(),
  socketRef: null,
  
  //Map: UserID -> User
  users: null,
  userID: null,
  state: null,
  lastPositions: null,
  controllersConnected: null,
  fps: 90,
  lastTime: null,
  currentTime: 0,
  deltaTime: 0,
  updateQueue: [],
  running: false,
  hmdObject: null,
  messageQueue: [],
  menues: new EmberMap(),


  gameLoop() {
    if(!this.running)
      return;

    this.currentTime = new Date().getTime();

    this.deltaTime = this.currentTime - this.lastTime;

    if(this.deltaTime > 1000/this.fps) {
      if(this.userID && this.state === 'connected') {
        let menues = [];
        this.menues.forEach((menu) => {
          menues.push(menu.mesh);
        });
        this.checkIntersectionRightController(menues);
        this.updateControllers();
        this.update();
        this.render2();
      }
      this.sendUpdates();

      this.lastTime = this.currentTime;
    }
    requestAnimationFrame(this.gameLoop.bind(this));
  },

  sendUpdates() {
    //there are updates to send
    if(this.updateQueue.length > 0) {
      this.send(this.updateQueue);
      this.set('updateQueue', []);
    }
  },

  didRender() {
    this._super(...arguments);
    this.loadHMDModel();

    this.set('users', EmberMap.create());
    this.set('lastPositions', { camera: null, controller1: null, controller2: null });
    this.set('controllersConnected', { controller1: false, controller2: false });
    this.set('lastTime', new Date().getTime());

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

    //initialize interaction events
    this.get('interaction').on('systemStateChanged', (id, isOpen) => {
      this.sendSystemUpdate(id, isOpen);
    });
    this.get('interaction').on('nodegroupStateChanged', (id, isOpen) => {
      this.sendNodegroupUpdate(id, isOpen);
    });
    this.on('applicationOpened', (id, app) => {
      this.sendAppOpened(id, app);
    });
    this.get('interaction').on('removeApplication',(appID) => {
      this.sendAppClosed(appID);
    });
    this.get('interaction').on('appReleased',(appID, position, quaternion) => {
      this.sendAppReleased(appID, position, quaternion);
    });
    this.get('interaction').on('appBinded',(appID, appPosition, appQuaternion, isBoundToController1, controllerPosition, controllerQuaternion) => {
      this.sendAppBinded(appID, appPosition, appQuaternion, isBoundToController1, controllerPosition, controllerQuaternion);
    });
    this.get('interaction').on('componentUpdate', (appID , componentID, isOpened) => {
      this.sendComponentUpdate(appID, componentID, isOpened);
    });
    this.get('interaction').on('landscapeMoved', () => {
      this.sendLandscapeUpdate();
    });
    this.get('interaction').on('entityHighlighted', (isHighlighted, appID, entityID, color) => {
      this.sendHighlightingUpdate(isHighlighted, appID, entityID, color);
    });
  },

  enqueueMessage(text) {
    this.messageQueue.unshift(text);
    if(this.messageQueue.length === 1) {
      this.showMessage();
    }
  },

  showMessage() {
    if(this.messageQueue.length <= 0)
      return;
    
    let message = this.messageQueue[this.messageQueue.length-1];
    this.createMessageBox(message);
    setTimeout(closeAfterTime.bind(this), 3000);

    function closeAfterTime() {
      this.deleteMessageBox();
      setTimeout(() => {
        if(this.messageQueue.length > 0) {
          this.messageQueue.pop();
          this.showMessage();
        }
      }, 800);
    }
  },

  checkIntersectionRightController(objects) {
    let controller = this.get('controller2');

    var tempMatrix = new THREE.Matrix4();

    // Calculate controller direction and origin
    tempMatrix.identity().extractRotation( controller.matrixWorld );
    
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);

    const direction = new THREE.Vector3(0,0,-1);
    direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );

    // Calculate hit object
    const intersectedViewObj = this.get('raycaster').raycasting(origin, direction, 
      null, objects);
    
    if(intersectedViewObj) {
      let name = intersectedViewObj.object.name;
      if(name.startsWith('menu_')) {
        let menu = this.menues.get(name);
        if(menu) {
          menu.interact('rightIntersect', intersectedViewObj.uv);
        }
      }
    }
  },

  createMessageBox(text) {
    let menu = new Menu();
    menu.set('title', 'menu_messageBox');
    menu.set('width', 512);
    menu.set('height', 64);
    menu.set('opacity', 0.5);
    menu.set('color', new THREE.Color(0,0,0));
    menu.addText(text, 20, { x: 256, y: 20}, '#FFFFFF', 'center');

    menu.interact = (interaction, position) => {
      //TODO
    };

    menu.createMesh();
    this.menues.set(menu.title, menu);

    let textBox = menu.mesh;
    textBox.position.y += 0.32;
    textBox.position.z -= 0.4;
    textBox.rotateX(0.45);

    this.camera.add(textBox);
    let y = 0;
    function animate() {
      y -= 0.01;
      if (y > -0.16) {
        textBox.position.y -=0.01;
      } else {
        return;
      }
      requestAnimationFrame(animate);
    }
    animate();
  },

  deleteMessageBox() {
    let messageBox = this.camera.getObjectByName('menu_messageBox');
    this.menues.delete('menu_messageBox');
    this.camera.remove(messageBox);
  },

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

  update() {
    this.updateAndSendPositions();
    this.sendControllerUpdate();
  },

  sendLandscapeUpdate(){
    let position = new THREE.Vector3();
    this.get('vrEnvironment').localToWorld(position);

    let quaternion = new THREE.Quaternion();
    this.get('vrEnvironment').getWorldQuaternion(quaternion);

    let landscapeObj = {
      "event": "receive_landscape_position",
      "time": Date.now(),
      "position" : position.toArray(),
      "quaternion" : quaternion.toArray()
    }
    this.updateQueue.push(landscapeObj);
  },

  sendSystemUpdate(id, isOpen){
    console.log("Sending system update");
    let systemObj = {
      "event": "receive_system_update",
      "time": Date.now(),
      "id": id,
      "isOpen": isOpen
    }
    this.updateQueue.push(systemObj);
  },

  sendNodegroupUpdate(id, isOpen){
    let nodeGroupObj = {
      "event": "receive_nodegroup_update",
      "time": Date.now(),
      "id": id,
      "isOpen": isOpen
    }
    this.updateQueue.push(nodeGroupObj);
  },

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
    this.updateQueue.push(appObj);
  },

  sendAppClosed(appID){
    let appObj = {
      "event": "receive_app_closed",
      "time": Date.now(),
      "id": appID
    }
    this.updateQueue.push(appObj);
  },

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
    this.updateQueue.push(appObj);
  },

  sendAppReleased(appID, position, quaternion){
    let appObj = {
      "event": "receive_app_released",
      "time": Date.now(),
      "id": appID,
      "position" : position.toArray(),
      "quaternion" : quaternion.toArray()
    }
    this.updateQueue.push(appObj);
  },

  sendComponentUpdate(appID, componentID, isOpened){
    let appObj = {
      "event": "receive_component_update",
      "time": Date.now(),
      "appID": appID,
      "componentID": componentID,
      "isOpened": isOpened
    }
    this.updateQueue.push(appObj);
  },

  sendHighlightingUpdate(isHighlighted, appID, entityID, color){
    let hightlightObj = {
      "event": "receive_hightlight_update",
      "time": Date.now(),
      "userID" : this.get('userID'),
      "appID": appID,
      "entityID": entityID,
      "isHighlighted": isHighlighted,
      "color": color
    }
    this.updateQueue.push(hightlightObj);
  },

  sendControllerUpdate() {
    let controllerObj = {
      "event": "receive_user_controllers",
      "time": Date.now()
    };

    let disconnect = [];
    let connect = {};

    let hasChanged = false;

    if(this.controllersConnected.controller1 && this.controller1.getGamepad() === undefined) {
      disconnect.push("controller1");
      this.controllersConnected.controller1 = false;
      hasChanged = true;
    }
    else if(!this.controllersConnected.controller1 && this.controller1.getGamepad() !== undefined) {
      connect.controller1 = this.controller1.getGamepad().id;
      this.controllersConnected.controller1 = true;
      hasChanged = true;
    }

    if(this.controllersConnected.controller2 && this.controller2.getGamepad() === undefined) {
      disconnect.push("controller2");
      this.controllersConnected.controller2 = false;
      hasChanged = true;
    }
    else if(!this.controllersConnected.controller2 && this.controller2.getGamepad() !== undefined) {
      connect.controller2 = this.controller2.getGamepad().id;
      this.controllersConnected.controller2 = true;
      hasChanged = true;
    }

    if(hasChanged) {
      if(Array.isArray(disconnect) && disconnect.length) {
        controllerObj.disconnect = disconnect;
      }
      if(Object.keys(connect).length !== 0) {
        controllerObj.connect = connect;
      }

      if(controllerObj.disconnect || controllerObj.connect) {
        this.updateQueue.push(controllerObj);
      }
    }
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
      //console.log(currentPositions.camera[0]);

      this.updateQueue.push(positionObj);
    }
  },

  disconnect() {
    const disconnectMessage = [{
      "event": "receive_disconnect_request"
    }];
    this.send(disconnectMessage);
  },

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
    this.currentTime = 0;
    this.deltaTime = 0;
    this.updateQueue = [];
  },

  openHandler(event) {
    console.log(`On open event has been called: ${event}`);
  },

  messageHandler(event) {
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
          this.onLandscapePosition(data.position, data.quaternion);
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
      }
    }
  },

  onSelfConnecting(data) {
    this.set('userID', data.id);
    let JSONObj = {
      "event": "receive_connect_request",
      "name": "" + data.id
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

    this.enqueueMessage(`${user.get('name')} just connected.`);

  },

  onUserDisconnect(data) {
    let { id } = data;
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
      this.get('users').delete(id);
      this.enqueueMessage(`${user.get('name')} disconnected.`);
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
      let quaternion = data.landscape.quaternion;
      this.onLandscapePosition(position, quaternion);
    }
  },

  onLandscapePosition(position, quaternion){
    this.get('vrEnvironment').position.fromArray(position);
    this.get('vrEnvironment').quaternion.fromArray(quaternion);
    if(this.get('vrEnvironment')){
      this.get('vrEnvironment').updateMatrix();
    }
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

    if(!app){
      return;
    }

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

  addUsername(userID){
    console.log("addUsername called");
    let user = this.get('users').get(userID);
    let camera = user.get('camera').model;
    let username = user.get('name');
    let width = 256;
    let height = 256;


    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = width;
    this.get('canvas2').height = height;
    let canvas2 = this.get('canvas2');
    var ctx = canvas2.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.0)';
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);


    ctx.font = `30px arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(username, canvas2.width / 2, 30);
       
    // create texture out of canvas
    let texture = new THREE.Texture(canvas2);

    // Update texture      
    texture.needsUpdate = true;
    // Update mesh material

    var spriteMaterial = new THREE.SpriteMaterial( { map: texture, color: 0xffffff } );
    var sprite = new THREE.Sprite( spriteMaterial );

    camera.add(sprite);
  },

  send(obj) {
    // console.log(`Sending: ${JSON.stringify(obj)}`);
    this.socketRef.send(JSON.stringify(obj));
  },

  closeHandler(event) {
    console.log(`On close event has been called: ${event}`);
  },

});
