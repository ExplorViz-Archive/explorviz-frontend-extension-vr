import { inject as service } from '@ember/service';
import EmberMap from '@ember/map';
import User from '../utils/multi-user/user';
import VRRendering from './vr-rendering';
//import THREE from 'three';
/*global ViveController*/

export default VRRendering.extend({
  websockets: service(),
  socketRef: null,
  //Map: UserID -> User
  users: EmberMap.create(),
  userID: null,

  didInsertElement() {
    this._super(...arguments);
    const socket = this.websockets.socketFor('ws://192.168.48.208:4444/');
    socket.on('open', this.openHandler, this);
    socket.on('message', this.messageHandler, this);
    socket.on('close', this.closeHandler, this);

    this.set('socketRef', socket);
    //call update function with 60 fps
    

  },

  update() {
    //send camera and controller position
    let positionObj = {
      "event": "position",
      "camera": {
        "position": this.camera.position.toArray(),
        "quaternion": this.camera.quaternion.toArray()
      },
      "controller1": {
        "position": this.controller1.position.toArray(),
        "quaternion": this.controller1.quaternion.toArray(),
      },
      "controller2": {
        "position": this.controller2.position.toArray(),
        "quaternion": this.controller2.quaternion.toArray()
      },
      "time": Date.now()
    };
    let JSONObj = JSON.stringify(positionObj);
    this.socketRef.send(JSONObj);
  },

  willDestroyElement() {
    this._super(...arguments);

    const socket = this.socketRef;
    socket.off('open', this.myOpenHandler);
    socket.off('message', this.myMessageHandler);
    socket.off('close', this.myCloseHandler);
  },

  openHandler(event) {
    console.log(`On open event has been called: ${event}`);
  },

  messageHandler(event) {
    const data = JSON.parse(event.data);
    if(data.event) {
      // message sent to client on own connect
      if(data.event === 'connecting') {
        console.log(`${event.data}`);
        this.set('userID', data.id);
        this.controller2.update();
        console.log(`You are connecting with id ${this.get('userID')}`);
        let JSONObj = {
          "event": "request_connect",
          "name": "" + data.id,
          "device": this.controller1.getGamepad().id.startsWith( 'Oculus Touch' ) ? "oculus" : "vive"
        };
        let message = JSON.stringify(JSONObj);
        this.socketRef.send(message);
      } else if(data.event === 'connected') {
        console.log(`${event.data}`);
        // create User model for all users and add them to the users map
        for (var i = 0; i < data.users.length; i++) {
          const userData = data.users[i];
          let user = User.create();
          user.set('name', userData.name);
          user.set('id', userData.id);
          user.set('device', userData.device);
          user.set('state', 'connected');
          user.init();
          this.get('users').set(userData.id, user);

          //add models for other users
          if(userData.id !== data.id && user.state === 'connected') {
            this.get('scene').add(user.get('camera.model'));
            this.get('scene').add(user.get('controller1.model'));
            this.get('scene').add(user.get('controller2.model'));
          }
        }
        console.log(`You just connected with id ${this.get('userID')}`);
        setInterval(this.update.bind(this), 1000 / 60);
      } else if(data.event === 'user_connecting') { // new user connecting
        console.log(`${event.data}`);
        console.log(`New client connecting with ID ${data.id}`);
      } else if(data.event === 'user_connected') { // new user connected
        console.log(`${event.data}`);
        let user = User.create();
        user.set('name', data.user.name);
        user.set('id', data.user.id);
        user.set('device', data.user.device);
        user.set('state', 'connected');
        user.init();
        this.get('users').set(data.user.id, user);

        //add model for new user
        this.get('scene').add(user.get('camera.model'));
        this.get('scene').add(user.get('controller1.model'));
        this.get('scene').add(user.get('controller2.model'));

        console.log(`${data.user.name} connected with ID ${data.user.id} and ${data.user.device}`);
      } else if(data.event === 'position') {
        let { camera, id, controller1, controller2 } = data;
        if(this.get('users').has(id)) {
          let user = this.get('users').get(id);
          user.updateControllers({ controller1, controller2 });
          user.updateCamera(camera);
        }
      }
    }
  },

  closeHandler(event) {
    console.log(`On close event has been called: ${event}`);
  },

});
