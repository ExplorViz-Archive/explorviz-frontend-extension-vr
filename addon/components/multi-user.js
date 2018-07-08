import Component from '@ember/component';
import { inject as service } from '@ember/service';
import EmberMap from '@ember/map';
import User from '../utils/multi-user/user';

export default Component.extend({
  socket: service("web-socket"),
  //Map: UserID -> User
  users: null,
  userID: null,

  init() {
    this._super(...arguments);
    this.get("socket").start(
      {open: this.openHandler, close: this.closeHandler, message: this.messageHandler},
      "localhost",
      4444
    );
  },

  openHandler(event) {
    console.log(`On open event has been called: ${event}`);
  },

  messageHandler(event) {
    const data = JSON.parse(event.data);
    console.log(`${event.data}`);
    if(data.event) {
      if(data.event === 'init') {
        this.set("users", EmberMap.create());
        for (var i = 0; i < data.users.length; i++) {
          const userData = data.users[i];
          const user = User.create();
          const userIDInt = parseInt(user.id, 10); //might not be necessary
          user.set("id", userIDInt);
          user.set("name", user.name);
          this.get("users").set(userIDInt, user);
        }
        this.set("userID", parseInt(data.id, 10));
        console.log(`You just connected with id ${this.get("userID")}`);
      }
      else if(data.event === 'user_connect') {
        console.log(`${data.user.name} connected with ID ${data.user.id}`);
      }
    }
  },

  closeHandler(event) {
    console.log(`On close event has been called: ${event}`);
  }

});
