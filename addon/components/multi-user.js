import { inject as service } from '@ember/service';
import EmberMap from '@ember/map';
import User from '../utils/multi-user/user';
import VRRendering from './vr-rendering';
import Ember from 'ember';
import THREE from 'three';

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

  gameLoop() {
    if(!this.running)
      return;

    this.currentTime = new Date().getTime();

    this.deltaTime = this.currentTime - this.lastTime;

    if(this.deltaTime > 1000/this.fps) {
      if(this.get('users').has(this.userID) && this.get('users').get(this.userID).state === 'connected') {
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
    const self = this;
    this._super(...arguments);

    console.log(this.get('users'));
    this.set('users', EmberMap.create());
    console.log(this.get('users'));
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
    this.get('interaction').on('systemStateChanged', function(id, isOpen) {
      self.sendSystemUpdate(id, isOpen);
    });
    this.get('interaction').on('nodegroupStateChanged', function(id, isOpen) {
      self.sendNodegroupUpdate(id, isOpen);
    });
    this.on('applicationOpened', function(id, app) {
      self.sendAppOpened(id, app);
    });
    this.get('interaction').on('removeApplication', function(appID) {
      self.sendAppClosed(appID);
    });
    this.get('interaction').on('appReleased', function(appID, position, quaternion){
      self.sendAppReleased(appID, position, quaternion);
    });
    this.get('interaction').on('appBinded', function(appID, appPosition, isBoundToController1, controllerPosition){
      self.sendAppBinded(appID, appPosition, isBoundToController1, controllerPosition);
    });
  },



  update() {
    this.updateAndSendPositions();
    this.sendControllerUpdate();
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

  sendAppBinded(appID, appPosition, isBoundToController1, controllerPosition){
    let appObj = {
      "event": "receive_app_binded",
      "time": Date.now(),
      "appID": appID,
      "appPosition" : appPosition.toArray(),
      "isBoundToController1" : isBoundToController1,
      "controllerPosition" : controllerPosition.toArray()
    }
    this.updateQueue.push(appObj);
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
        case 'receive_system_update':
          console.log(data);
          this.onLandscapeUpdate(data.id, data.isOpen);
          break;
        case 'receive_nodegroup_update':
          console.log(data);
          this.onLandscapeUpdate(data.id, data.isOpen);
          break;
        case 'receive_app_opened':
          console.log(data);
          this.onAppOpened(data.id, data.position, data.quaternion);
          break;
        case 'receive_app_closed':
          console.log(data);
          this.onAppClosed(data.id);
          break;
        case 'receive_app_binded':
          console.log(data);
          this.onAppBinded(data.appID, data.appPosition, data.isBoundToController1, data.controllerPosition);
          break;
        case 'receive_app_released':
          console.log(data);
          this.onAppReleased(data.id, data.position, data.quaternion);
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
      let user = User.create();
      user.set('name', userData.name);
      user.set('id', userData.id);
      user.set('state', 'connected');
      user.init();

      if(userData.controllers.controller1) {
        user.initController1(userData.controllers.controller1);
        if(userData.id !== this.get('userID') && user.state === 'connected')
          this.get('scene').add(user.get('controller1.model'));
      }
      if(userData.controllers.controller2) {
        user.initController2(userData.controllers.controller2);
        if(userData.id !== this.get('userID') && user.state === 'connected')
          this.get('scene').add(user.get('controller2.model'));
      }

      this.get('users').set(userData.id, user);

      //add models for other users
      if(userData.id !== this.get('userID') && user.state === 'connected') {
        this.get('scene').add(user.get('camera.model'));
      }
    }
  },

  onUserConnected(data) {
    let user = User.create();
    user.set('name', data.user.name);
    user.set('id', data.user.id);
    user.set('state', 'connected');
    user.init();
    this.get('users').set(data.user.id, user);

    //add model for new user
    this.get('scene').add(user.get('camera.model'));
  },

  onUserDisconnect(data) {
    let { id } = data;
    if(this.get('users') && this.get('users').has(id)) {
      let user = this.get('users').get(id);
      this.get('scene').remove(user.get('controller1.model'));
      user.removeController1();
      this.get('scene').remove(user.get('controller2.model'));
      user.removeController2();
      this.get('scene').remove(user.get('camera.model'));
      user.removeCamera();
      this.get('users').delete(id);
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
        user.initController1(connect.controller1);
        console.log("Controller1 connected");
        this.get('scene').add(user.get('controller1.model'));
      }
      if(connect.controller2) {
        user.initController2(connect.controller2);
        console.log("Controller2 connected");
        this.get('scene').add(user.get('controller2.model'));
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
    this.setLandscapeState(systems, nodeGroups);
  },

  onLandscapeUpdate(id, isOpen){
    this.setEntityState(id, isOpen);
  },

  onAppOpened(id, position, quaternion){
    this.showApplication(id, position, quaternion);
  },

  onAppClosed(appID){
    if (this.get('openApps').has(appID)) {
      this.removeChildren(this.get('openApps').get(appID));
      this.get('openApps').delete(appID);
    } 
  },

  onAppBinded(appID, appPosition, isBoundToController1, controllerPosition){
    console.log("onAppBinded is called");
    console.log("appID: " + appID);
    if (!this.get('openApps').has(appID)){
      return;
    }
    let app = this.get('openApps').get(appID);
    app.position.x = appPosition[0];
    app.position.y = appPosition[1];
    app.position.z = appPosition[2];

    let controller;
    if (isBoundToController1){
      controller = this.get('controller1');
    } else {
      controller = this.get('controller2');
    }
    controller.position.x = controllerPosition[0];
    controller.position.x = controllerPosition[1];
    controller.position.x = controllerPosition[2];

    var tempMatrix = new THREE.Matrix4();
    // Get inverse of controller transoformation      
    tempMatrix.getInverse(controller.matrixWorld);

    tempMatrix.identity().extractRotation( controller.matrixWorld );
    

    // Set transforamtion relative to controller transformation
    app.matrix.premultiply( tempMatrix );
    // Split up matrix into position, quaternion and scale
    app.matrix.decompose( app.position, app.quaternion, app.scale);
    // Add object to controller
    controller.add(app);
    // Store object 
    controller.userData.selected = app; 

  },

  onAppReleased(appID, position, quatArray){
    if (this.get('openApps').has(appID)) {
      console.log("onAppReleased: App found");
      /*
      let app = this.get('openApps').get(appID).userData.model;
      let quaternion = new THREE.Quaternion(quatArray[0], quatArray[1], quatArray[2], quatArray[3]);

      // Empty application 3D (remove app3D)
      this.removeChildren(this.get('openApps').get(appID));

      //self.get('openApps').delete(app3DModel.id);
      // Add application3D to scene
      this.add3DApplicationToLandscape(app, position, quaternion);
      this.get('openApps').get(appID).updateMatrix();*/
      //var appPosition = this.get('openApps').get(appID).position;
      var appPosition = new THREE.Vector3(position[0], position[1], position[2]);
      var appQuaternion = new THREE.Quaternion(quatArray[0], quatArray[1], quatArray[2], quatArray[3]);
      let app3DModel = this.get('openApps').get(appID).userData.model;

      // Empty application 3D (remove app3D)
      this.removeChildren(this.get('openApps').get(appID));

      //self.get('openApps').delete(app3DModel.id);
      // Add application3D to scene
      this.add3DApplicationToLandscape(app3DModel, appPosition, appQuaternion);
      this.get('openApps').get(appID).updateMatrix();
     }       
  },


  send(obj) {
    // console.log(`Sending: ${JSON.stringify(obj)}`);
    this.socketRef.send(JSON.stringify(obj));
  },

  closeHandler(event) {
    console.log(`On close event has been called: ${event}`);
  },

});
