import { inject as service } from '@ember/service';
import EmberMap from '@ember/map';
import User from '../utils/multi-user/user';
import VRRendering from './vr-rendering';
import THREE from 'three';

export default VRRendering.extend({
  websockets: service(),
  socketRef: null,
  //Map: UserID -> User
  users: null,
  userID: null,

  didInsertElement() {
    this._super(...arguments);
    const socket = this.websockets.socketFor('ws://localhost:4444/');
    socket.on('open', this.openHandler, this);
    socket.on('message', this.messageHandler, this);
    socket.on('close', this.closeHandler, this);

    this.set('socketRef', socket);

    //call update function with 60 fps
    setInterval(this.update.bind(this), 1000 / 60);
  },

  update() {
    //send camera position
    let positionObj = {
      "event": "position",
      "id": this.get('userID'),
      "camera": this.camera.position.toArray(),
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
    console.log(`${event.data}`);
    if(data.event) {
      // message sent to client on own connect
      if(data.event === 'init') {
        this.set("users", EmberMap.create());
        // create User model for all users and add them to the users map
        for (var i = 0; i < data.users.length; i++) {
          const userData = data.users[i];
          const user = User.create();
          user.init();
          user.set('id', userData.id);
          user.set('name', userData.name);
          this.get('users').set(userData.id, user);
          if(userData.id !== data.id)
            this.get('scene').add(user.get('mesh'));
        }
        // set own id
        this.set('userID', data.id);
        console.log(`You just connected with id ${this.get('userID')}`);
      } else if(data.event === 'user_connect') { // new user connected
        let user = User.create();
        user.init();
        user.set('name', data.user.name);
        user.set('id', data.user.id);
        user.set('camera', new THREE.Vector3());

        this.get('users').set(data.user.id, user);
        
        this.get('scene').add(user.get('mesh'));

        console.log(`${data.user.name} connected with ID ${data.user.id}`);
      } else if(data.event === 'position') {
        let { camera, id, controllers } = data;
        let user = this.get('users').get(id);
        //+2 translation for testing purposes
        user.setPosition(new THREE.Vector3(camera[0]+2, camera[1], camera[2]));
        
      }
    }
  },

  closeHandler(event) {
    console.log(`On close event has been called: ${event}`);
  },

});
