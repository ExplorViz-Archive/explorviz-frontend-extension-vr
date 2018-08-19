import { inject as service } from '@ember/service';
import User from '../utils/multi-user/user';
import Menu from '../utils/multi-user/menu';
import VRRendering from './vr-rendering';
import Ember from 'ember';
import THREE from 'three';

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
  
  users: null, //Map: UserID -> User
  userID: null, //own userID
  state: null, //own connection status
  lastPositions: null, //last positions of camera and controllers
  controllersConnected: null, //tells which controller(s) are connected
  fps: 90, //tells how often a picture is rendered per second (refresh rate of Vive/Rift is 90)
  lastTime: null, //last time an image was rendered
  currentTime: 0, //tells the current time in ms
  deltaTime: 0, //time between two frames
  updateQueue: [], //messages which are ready to be sent to backend
  running: false, //tells if gameLoop is executing
  hmdObject: null, //object for other user's hmd
  messageQueue: [], //messages displayed on top edge of hmd (e.g. user x connected)
  isSpectating: false, //tells whether this user is spectating
  spectatedUser: null, //tells which userID (if any) is being spectated
  menus: new Map(), //keeps track of menus for settings
  optionsMenu: null,
  userListMenu: null,
  startPosition: null, //position before this user starts spectating
  session: Ember.inject.service('session'),


  gameLoop() {
    if(!this.running){
      return;
    }

    this.currentTime = new Date().getTime();

    //time difference between now and the last time updates were sent
    this.deltaTime = this.currentTime - this.lastTime;

    //if time difference is large enough, update and send messages to backend
    if(this.deltaTime > 1000/this.fps) {
      //if not connected yet controllers need not to be considered
      if(this.userID && this.state === 'connected') {
        this.updateControllers();
        this.update();
        if (this.get('isSpectating')){
          this.spectateUser();
        }
        this.render2();
      }

      //send messages like connecting request, position updates etc.
      this.sendUpdates();

      this.lastTime = this.currentTime;
    }
    requestAnimationFrame(this.gameLoop.bind(this));
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

  activateSpectating(userID){
    if(this.get('isSpectating')){
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
    this.set('isSpectating', true);
    this.sendSpectatingUpdate();
  },

  deactivateSpectating(){
    if(!this.spectatedUser)
      return;
    let spectatedUser = this.get('users').get(this.get('spectatedUser'));
    spectatedUser.camera.model.visible = true;
    this.set('isSpectating', false);
    this.set('spectatedUser', null);

    let position = this.get('startPosition');
    this.get('user.position').fromArray(position.toArray());

    this.sendSpectatingUpdate();
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
        if(!self.isSpectating)
          old_checkIntersectionRightController.apply(this);
        else
          self.get('controller2').getObjectByName('controllerLine').scale.z = self.zeroValue;
      }
    };
    
    let old_checkIntersectionLeftController = this.get('interaction').checkIntersectionLeftController;
    this.get('interaction').checkIntersectionLeftController = function() {
      if(!self.isSpectating)
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
        if(!self.isSpectating)
          old_onTriggerDownController2.apply(this, [event]);
      }
    };

    let old_onTriggerDownController1 = this.get('interaction').onTriggerDownController1;
    this.get('interaction').onTriggerDownController1 = function(event) {
      if(!self.isSpectating)
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
    this.get('interaction').on('landscapeMoved', (deltaPosition) => {
      this.sendLandscapeUpdate(deltaPosition);
    });
    this.get('interaction').on('entityHighlighted', (isHighlighted, appID, entityID, color) => {
      this.sendHighlightingUpdate(isHighlighted, appID, entityID, color);
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

  /**
   * Add text to messageQueue which should be displayed on top edge of hmd
   * @param {{title: string, text: string}} message Title and text which should be displayed
   */
  enqueueMessage(message) {
    this.messageQueue.unshift(message);
    if(this.messageQueue.length === 1) {
      this.showMessage();
    }
  },

  /**
   * Displays text messages on the top edge of the hmd for 3 seconds
   */
  showMessage() {
    if(this.messageQueue.length <= 0)
      return;
    
    let message = this.messageQueue[this.messageQueue.length-1];
    this.createMessageBox(message.title, message.text);
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
    if(!this.isSpectating) {
      if(!this.optionsMenu)
        this.openOptionsMenu();
      else
        this.closeOptionsMenu();
    } else {
      this.deactivateSpectating();
      this.closeOptionsMenu();
    }
  },

  openOptionsMenu() {
    let menu = new Menu({
      title: 'optionsMenu',
      resolution: { width: 256, height: 256 },
      size: { height: 0.3, width: 0.3},
      opacity: 0.8,
      color: '#444444',
    });
    menu.addText('Options', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
    menu.addText('Change Height', 'change_height', 14, { x: 128, y: 70}, '#ffc338', 'center', true);
    menu.addText('Change Landscape Position', 'change_landscape_position', 14, { x: 128, y: 100}, '#ffc338', 'center', true);
    menu.addText('Spectate', 'spectate', 14, { x: 128, y: 130}, '#ffc338', 'center', true);
    menu.addText('Exit', 'exit', 14, { x: 128, y: 220}, '	#ffffff', 'center', true);
    menu.interact = (action, position) => {
      let item = menu.getItem(position);
      if(item) {
        if(action === 'rightIntersect') {
          menu.setHover(item);
        }
        if(action === 'rightTrigger') {
          if(item.name === 'exit') {
            this.closeOptionsMenu();
          } else if(item.name === 'change_height') {
            this.closeOptionsMenu();
            this.openChangeCameraHeightMenu(this.openOptionsMenu);
          } else if(item.name === 'change_landscape_position') {
            this.closeOptionsMenu();
            this.openChangeLandscapePosition(this.openOptionsMenu);
          } else if(item.name === 'spectate') {
            this.closeOptionsMenu();
            this.openSpectateMenu(this.openOptionsMenu);
          }
        }
      } else {
        menu.setHover(null);
      }
    };

    menu.createMesh();
    menu.mesh.position.x += 0.2;
    menu.mesh.geometry.rotateX(1.5707963267949 * 3);
    this.controller1.add(menu.mesh);
    this.menus.set(menu.title, menu);
    this.optionsMenu = menu;
  },

  closeOptionsMenu() {
    this.controller1.remove(this.optionsMenu.mesh);
    this.optionsMenu.close();
    this.menus.delete(this.optionsMenu.title);
    this.optionsMenu = null;
  },

  openChangeCameraHeightMenu(lastMenu) {
    let menu = new Menu({
      title: 'changeCameraHeightMenu',
      resolution: { width: 256, height: 256 },
      size: { height: 0.3, width: 0.3},
      opacity: 0.8,
      color: '#444444',
    });
    menu.addText('Change Height', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
    menu.addArrowButton('height_down', {x: 30, y: 103}, {x: 60, y: 133}, 'arrow_down', '#ffc338');
    menu.addArrowButton('height_up', {x: 196, y: 103}, {x: 226, y: 133}, 'arrow_up', '#ffc338');
    menu.addText(this.user.position.y.toFixed(2), 'camera_height', 14, { x: 128, y: 113}, '#ffffff', 'center', false);
    menu.addText('Back', 'back', 14, { x: 128, y: 220}, '	#ffffff', 'center', true);
    menu.interact = (action, position) => {
      let item = menu.getItem(position);
      if(item) {
        if(action === 'rightIntersect') {
          menu.setHover(item);
        }
        if(action === 'rightTrigger') {
          if(item.name === 'height_down') {
            this.get('user').position.y -= 0.05;
            menu.updateText('camera_height', this.get('user').position.y.toFixed(2));
          } else if(item.name === 'height_up') {
            this.get('user').position.y += 0.05;
            menu.updateText('camera_height', this.get('user').position.y.toFixed(2));
          } else if(item.name === 'back') {
            this.closeOptionsMenu();
            lastMenu.bind(this)();
          }
        }
      } else {
        menu.setHover(null);
      }
    };
    menu.createMesh();
    menu.mesh.position.x += 0.2;
    menu.mesh.geometry.rotateX(-1.5707963267949);
    this.controller1.add(menu.mesh);
    this.menus.set(menu.title, menu);
    this.optionsMenu = menu;
  },

  openChangeLandscapePosition(lastMenu) {
    let menu = new Menu({
      title: 'changeLandscapePositionMenu',
      resolution: { width: 256, height: 256 },
      size: { height: 0.3, width: 0.3},
      opacity: 0.8,
      color: '#444444',
    });
    menu.addText('Change Landscape Position', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
    menu.addArrowButton('move_left', {x: 70, y: 103}, {x: 90, y: 133}, 'arrow_left', '#ffc338');
    menu.addArrowButton('move_right', {x: 166, y: 103}, {x: 186, y: 133}, 'arrow_right', '#ffc338');
    menu.addArrowButton('move_forward', {x: 113, y: 60}, {x: 143, y: 80}, 'arrow_up', '#ffc338');
    menu.addArrowButton('move_backward', {x: 113, y: 156}, {x: 143, y: 176}, 'arrow_down', '#ffc338');
    menu.addText('Back', 'back', 14, { x: 128, y: 220}, '	#ffffff', 'center', true);
    menu.interact = (action, position) => {
      let item = menu.getItem(position);
      if(item) {
        if(action === 'rightIntersect') {
          menu.setHover(item);
        }
        if(action === 'rightTrigger') {
          if(item.name === 'move_left') {
            this.moveLandscape({x: 20, y: 0});
          } else if(item.name === 'move_right') {
            this.moveLandscape({x: -20, y: 0});
          } else if(item.name === 'move_forward') {
            this.moveLandscape({x: 0, y: 20});
          } else if(item.name === 'move_backward') {
            this.moveLandscape({x: 0, y: -20});
          } else if(item.name === 'back') {
            this.closeOptionsMenu();
            lastMenu.bind(this)();
          }
        }
      } else {
        menu.setHover(null);
      }
    };
    menu.createMesh();
    menu.mesh.position.x += 0.2;
    menu.mesh.geometry.rotateX(-1.5707963267949);
    this.controller1.add(menu.mesh);
    this.menus.set(menu.title, menu);
    this.optionsMenu = menu;
  },

  openSpectateMenu(lastMenu) {
    let menu = new Menu({
      title: 'spectateMenu',
      resolution: { width: 256, height: 256 },
      size: { height: 0.3, width: 0.3},
      opacity: 0.8,
      color: '#444444',
    });
    menu.addText('Spectate', 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
    menu.addArrowButton('previous_user', {x: 30, y: 103}, {x: 50, y: 133}, 'arrow_left', '#ffc338');
    menu.addArrowButton('next_user', {x: 206, y: 103}, {x: 226, y: 133}, 'arrow_right', '#ffc338');
    menu.addText('Spectating no-one', 'spectating_user', 14, { x: 128, y: 113}, '#ffffff', 'center', false);
    menu.addText('Go Back and Stop Spectating', 'back', 14, { x: 128, y: 220}, '	#ffffff', 'center', true);
    menu.interact = (action, position) => {
      let item = menu.getItem(position);
      if(item) {
        if(action === 'rightIntersect') {
          menu.setHover(item);
        }
        if(action === 'rightTrigger') {
          if(item.name === 'next_user') {
            if(this.users.size < 1)
              return;

            let users = this.users.keys();
            let userArray = []
            for(let id of users) {
              userArray.push(id);
            }

            userArray.sort();

            if(!this.spectatedUser) {
              this.activateSpectating(userArray[0]);
              menu.updateText('spectating_user', this.users.get(userArray[0]).name);
              return;
            }
            
            let index = this.binaryIndexOf(userArray, this.spectatedUser);

            if(index !== -1) {
              if(index === userArray.length - 1) {
                this.activateSpectating(userArray[0]);
                menu.updateText('spectating_user', this.users.get(userArray[0]).name);
              } else {
                this.activateSpectating(userArray[index+1]);
                menu.updateText('spectating_user', this.users.get(userArray[index+1]).name);
              }
            }
          } else if(item.name === 'previous_user') {
            if(this.users.size < 1)
              return;

              let users = this.users.keys();
              let userArray = []
              for(let id of users) {
                userArray.push(id);
              }
  
              userArray.sort();
  
              if(!this.spectatedUser) {
                this.activateSpectating(userArray[userArray.length-1]);
                menu.updateText('spectating_user', this.users.get(userArray[userArray.length-1]).name);
                return;
              }
            
              let index = this.binaryIndexOf(userArray, this.spectatedUser);
  
              if(index !== -1) {
                if(index === 0) {
                  this.activateSpectating(userArray[userArray.length-1]);
                  menu.updateText('spectating_user', this.users.get(userArray[userArray.length-1]).name);
                } else {
                  this.activateSpectating(userArray[index-1]);
                  menu.updateText('spectating_user', this.users.get(userArray[index-1]).name);
                }
              }
          } else if(item.name === 'back') {
            this.deactivateSpectating();
            this.closeOptionsMenu();
            lastMenu.bind(this)();
          }
        }
      } else {
        menu.setHover(null);
      }
    };
    menu.createMesh();
    menu.mesh.position.x += 0.2;
    menu.mesh.geometry.rotateX(-1.5707963267949);
    this.controller1.add(menu.mesh);
    this.menus.set(menu.title, menu);
    this.optionsMenu = menu;
  },

  createMessageBox(title, text) {
    let menu = new Menu({
      title: 'messageBox',
      resolution: { width: 256, height: 64 },
      size: { width: 0.2, height: 0.05 },
      opacity: 0.7,
      color: '#000000',
    });
    menu.addText(title, 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
    menu.addText(text, 'text', 14, { x: 128, y: 40}, 'lightgreen', 'center', false);
    menu.interact = (action, position) => {};

    menu.createMesh();
    this.menus.set(menu.title, menu);

    let textBox = menu.mesh;
    textBox.position.y += 0.3;
    textBox.position.z -= 0.3;
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

  /**
   * Remove text message on top edge of user's view
   */
  deleteMessageBox() {
    let messageBox = this.camera.getObjectByName('messageBox');
    this.menus.delete('messageBox');
    this.camera.remove(messageBox);
  },

  onGripDownController1() {
    this.openUserListMenu();
  },

  onGripUpController1() {
    this.deleteUserListMenu();
  },

  /**
   * Remove user list menu in the middle of the screen
   */
  deleteUserListMenu() {
    if(!this.userListMenu)
      return;

    let menu = this.camera.getObjectByName(this.userListMenu.title);
    this.menus.delete(this.userListMenu.title);
    this.camera.remove(menu);
    this.userListMenu = null;
  },

  openUserListMenu() {
    if(this.userListMenu)
      return;
    
    let menu = new Menu({
      title: 'userListMenu',
      resolution: { width: 256, height: 256 },
      size: { width: 0.3, height: 0.3 },
      opacity: 0.8,
      color: '#444444',
    });

    menu.addText('Users', 'title', 18, { x: 20, y: 20}, '#ffffff', 'left', false);

    let users = this.users.values();
    let playingUsers = [];
    let spectatingUsers = [];
    for(let user of users) {
      if(user.state === 'connected') {
        playingUsers.push(user);
      } else if(user.state === 'spectating') {
        spectatingUsers.push(user);
      }
    }

    menu.addText('Connected', 'connected', 14, { x: 40, y: 50}, '#ffffff', 'left', false);

    let yOffset = 20;
    let yPos = 50 + yOffset;

    if(this.state === 'connected') {
      menu.addText('>> You <<', 'connected', 12, { x: 50, y: yPos}, '#a7adba', 'left', false);
      yPos += yOffset;
    }


    for(let i = 0; i < playingUsers.length; i++) {
      let userColor = playingUsers[i].color;
      menu.addText(playingUsers[i].name, 'connected', 12, { x: 50, y: yPos + i*yOffset}, this.rgbToHex(userColor), 'left', false);
    }

    yPos = yPos + yOffset*(playingUsers.length);

    menu.addText('Spectating', 'spectating', 14, { x: 40, y: yPos}, '#ffffff', 'left', false);

    yPos += yOffset;

    if(this.state === 'spectating') {
      menu.addText('>> You <<', 'connected', 12, { x: 50, y: yPos}, '#a7adba', 'left', false);
      yPos += yOffset;
    }
    
    for(let i = 0; i < spectatingUsers.length; i++) {
      let userColor = spectatingUsers[i].color;
      menu.addText(spectatingUsers[i].name, 'spectating', 12, { x: 50, y: yPos + i*yOffset}, this.rgbToHex(userColor), 'left', false);
    }

    menu.interact = (action, position) => {};

    menu.createMesh();
    menu.mesh.position.y += 0.0;
    menu.mesh.position.z -= 0.5;
    this.camera.add(menu.mesh);
    this.menus.set(menu.title, menu);
    this.userListMenu = menu;
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
    this.sendControllerUpdate();
  },

  /**
   * Send update of position + quaternion of the
   * landscape (vrEnvironment)
   */
  sendLandscapeUpdate(deltaPosition){
    let quaternion =  this.get('vrEnvironment').quaternion;

    let landscapeObj = {
      "event": "receive_landscape_position",
      "time": Date.now(),
      "deltaPosition" : deltaPosition.toArray(),
      "quaternion" : quaternion.toArray()
    }
    this.updateQueue.push(landscapeObj);
  },

  /**
   * Send the backend the information that a system was
   * closed or opened by this user
   * @param {Long} id ID of system which was opened/closed
   * @param {boolean} isOpen State of the system
   */
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
    this.updateQueue.push(nodeGroupObj);
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
    this.updateQueue.push(appObj);
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
    this.updateQueue.push(appObj);
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
    this.updateQueue.push(appObj);
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
    this.updateQueue.push(appObj);
  },

  /**
   * Informs the backend that a component was opened or closed by this user
   * @param {Long} appID ID of the app which is a parent to the component
   * @param {Long} componentID ID of the component which was opened or closed
   * @param {boolean} isOpened Tells whether the component is now open or closed (current state)
   */
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

  /**
   * Informs the backend that an entity (clazz or component) was highlighted
   * or unhighlighted
   * @param {boolean} isHighlighted Tells whether the entity has been highlighted or not
   * @param {Long} appID ID of the parent application of the entity
   * @param {Long} entityID ID of the highlighted/unhighlighted component/clazz
   * @param {Color} color Original color of the entity as hex value
   */
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

  sendSpectatingUpdate(){
    let spectateObj = {
      "event": "receive_spectating_update",
      "userID": this.get('userID'),
      "isSpectating": this.get('isSpectating'),
      "spectatedUser": this.get('spectatedUser'),
      "time": Date.now()
    }
    this.updateQueue.push(spectateObj);
  },

  /**
   * Informs the backend if a controller was connected/disconnected
   */
  sendControllerUpdate() {
    let controllerObj = {
      "event": "receive_user_controllers",
      "time": Date.now()
    };

    let disconnect = [];
    let connect = {};

    let hasChanged = false;

    //handle that controller 1 has disconnected
    if(this.controllersConnected.controller1 && this.controller1.getGamepad() === undefined) {
      disconnect.push("controller1");
      this.controllersConnected.controller1 = false;
      hasChanged = true;
    }
    //handle that controller 1 has connected
    else if(!this.controllersConnected.controller1 && this.controller1.getGamepad() !== undefined) {
      connect.controller1 = this.controller1.getGamepad().id;
      this.controllersConnected.controller1 = true;
      hasChanged = true;
    }

    //handle that controller 2 has disconnected
    if(this.controllersConnected.controller2 && this.controller2.getGamepad() === undefined) {
      disconnect.push("controller2");
      this.controllersConnected.controller2 = false;
      hasChanged = true;
    }
    //handle that controller 2 has connected
    else if(!this.controllersConnected.controller2 && this.controller2.getGamepad() !== undefined) {
      connect.controller2 = this.controller2.getGamepad().id;
      this.controllersConnected.controller2 = true;
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
      this.updateQueue.push(positionObj);
    }
  },

  /**
   * Inform the backend that we leave the session
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
      }
    }
  },

  /**
   * After socket has opened to backend client is told his/her userID.
   * Respond by asking for "connected" status.
   * @param {JSON} data Message containing own userID
   */
  onSelfConnecting(data) {
    this.set('userID', data.id);
    let JSONObj = {
      "event": "receive_connect_request",
      "name": this.get('session.data.authenticated.username')
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

    this.enqueueMessage({title: 'User connected', text: user.get('name')});

  },

  onUserDisconnect(data) {
    let { id } = data;

    //do not spectate a disconnected user
    if (this.get('spectatedUser') == id){
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
      this.get('users').delete(id);
      this.enqueueMessage({title: 'User disconnected', text: user.get('name')});
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

  onSpectatingUpdate(userID, isSpectating){
    let user = this.get('users').get(userID);
    if (isSpectating){
      user.setVisible(false);
    } else {
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

    let textSize = this.getTextSize(username);
    console.log("Size: " + textSize.width + ", " + textSize.height);

    //note: sprites are always same width + height
    let width = textSize.width * 3 + 20;
    let height = textSize.height * 5;


    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = width;
    this.get('canvas2').height = height;
    let canvas2 = this.get('canvas2');
    var ctx = canvas2.getContext('2d');
    ctx.fillStyle = 'rgba(200, 200, 216, 0.5)';
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);


    ctx.font = `30px arial`;
    ctx.fillStyle = this.rgbToHex(user.get('color'));
    ctx.textAlign = 'center';
    ctx.fillText(username, canvas2.width / 2, 35);
       
    // create texture out of canvas
    let texture = new THREE.Texture(canvas2);

    // Update texture      
    texture.needsUpdate = true;

    let geometry = new THREE.PlaneGeometry(width / 500, height / 500, 32 );
    let material = new THREE.MeshBasicMaterial( {map: texture, color: 0xffffff, side: THREE.DoubleSide} );
    material.transparent = true;
    material.opacity = 0.8;
    let plane = new THREE.Mesh( geometry, material );

    plane.position.x = camera.position.x;
    plane.position.y = camera.position.y + 0.3;
    plane.position.z = camera.position.z;

    user.namePlane = plane;

    //sprite moves with hmd of user
    camera.add(plane);
  },

  setEntityState(id, isOpen){
    const self = this;
    this.get('vrLandscape').children.forEach(function (system) {
      if (system.userData.model && system.userData.model.id == id) {
        system.userData.model.setOpened(isOpen);
        self.populateScene();
        return;
      }
    });
  },

  setLandscapeState(systems, nodegroups){
    let vrLandscape = this.get('vrLandscape').children;
    systems.forEach(system => {
      let emberModel = this.get('store').peekRecord('system', system.id);
      emberModel.setOpened(system.opened);
    });
    this.populateScene();

    nodegroups.forEach(function (nodegroup){
      let id = nodegroup.id;
      let isOpen = nodegroup.opened;
      vrLandscape.forEach(entity => {
        if (entity.userData.model && entity.userData.model.id == id) {
          entity.userData.model.setOpened(isOpen);
        }
      });
    });

        /*
    nodegroups.forEach(nodegroup => {
      let emberModel = this.get('store').peekRecord('nodegroup', nodegroup.id);
      emberModel.setOpened(nodegroup.opened);
    });*/

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

  moveLandscape(delta) {
    let distanceXInPercent = (delta.x / -100.0);
    let distanceYInPercent = (delta.y / 100.0);

    this.get('environmentOffset').x += distanceXInPercent;
    this.get('environmentOffset').z -= distanceYInPercent;

    this.get('vrEnvironment').position.x +=  distanceXInPercent;
    this.get('vrEnvironment').position.z -= distanceYInPercent;
    this.updateObjectMatrix(this.get('vrEnvironment'));

    let deltaPosition = new THREE.Vector3(distanceXInPercent, 0, distanceYInPercent);
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

  //called when user closes the site
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

    /**
   * Performs a binary search on the host array. This method can either be
   * injected into Array.prototype or called with a specified scope like this:
   * binaryIndexOf.call(someArray, searchElement);
   *
   * @param {*} searchElement The item to search for within the array.
   * @return {Number} The index of the element which defaults to -1 when not found.
   */
  binaryIndexOf(array, searchElement) {
    var minIndex = 0;
    var maxIndex = array.length - 1;
    var currentIndex;
    var currentElement;

    while (minIndex <= maxIndex) {
        currentIndex = (minIndex + maxIndex) / 2 | 0;
        currentElement = array[currentIndex];

        if (currentElement < searchElement) {
            minIndex = currentIndex + 1;
        }
        else if (currentElement > searchElement) {
            maxIndex = currentIndex - 1;
        }
        else {
            return currentIndex;
        }
    }

    return -1;
  },

  getTextSize(text, font) {
    // re-use canvas object for better performance
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");
    context.font = font;
    let width = context.measureText(text).width;
    let height = context.measureText("W").width;
    var sublineHeight = context.measureText("H").width;
    return { width, height, sublineHeight };
  },

  rgbToHex(rgbArray) {
    return "#" + ((1 << 24) + (rgbArray[0] << 16) + (rgbArray[1] << 8) + rgbArray[2]).toString(16).slice(1);
  }

});
