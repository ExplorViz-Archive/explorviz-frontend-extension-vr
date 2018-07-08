import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
  socket: service("web-socket"),

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
    if(data.event) {
      if(data.event === 'init') {
        console.log(`You just connected with id ${data.id}`);
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
