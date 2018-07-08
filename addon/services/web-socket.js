import Service, { inject as service } from '@ember/service';

export default Service.extend({
  websockets: service(),
  socketRef: null,

  init() {
    this._super(...arguments);
  },

  start() {

    //create WebSocket
    const socket = this.websockets.socketFor('ws://localhost:4444/');
    socket.on('open', this.myOpenHandler, this);
    socket.on('message', this.myMessageHandler, this);
    socket.on('close', this.myCloseHandler, this);

    this.set('socketRef', socket);
  },

  destroy() {
    this._super(...arguments);

    const socket = this.socketRef;

    //remove listeners
    socket.off('open', this.myOpenHandler);
    socket.off('message', this.myMessageHandler);
    socket.off('close', this.myCloseHandler);
  },

  myOpenHandler(event) {
    console.log(`On open event has been called: ${event}`);
  },

  myMessageHandler(event) {
    console.log(`Message: ${event.data}`);
  },

  myCloseHandler(event) {
    console.log(`On close event has been called: ${event}`);
  }
  
});