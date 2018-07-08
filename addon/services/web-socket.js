import Service, { inject as service } from '@ember/service';

export default Service.extend({
  websockets: service(),
  socketRef: null,
  openHandler: null,
  messageHandler: null,
  closeHandler: null,


  init() {
    this._super(...arguments);
  },

  start(handler, address, port) {
    const {open, close, message} = handler;
    this.set("openHandler", open);
    this.set("closeHandler", close);
    this.set("messageHandler", message);

    //create WebSocket
    const socket = this.websockets.socketFor(`ws://${address}:${port}`);

    socket.on('open', this.openHandler, this);
    socket.on('message', this.messageHandler, this);
    socket.on('close', this.closeHandler, this);

    this.set('socketRef', socket);
  },

  destroy() {
    this._super(...arguments);

    const socket = this.socketRef;

    //remove listeners
    socket.off('open', this.openHandler);
    socket.off('message', this.messageHandler);
    socket.off('close', this.closeHandler);

    this.set("openHandler", null);
    this.set("closeHandler", null);
    this.set("messageHandler", null);
  }
  
});