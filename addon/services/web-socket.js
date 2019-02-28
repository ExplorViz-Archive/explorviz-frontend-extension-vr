import Service, { inject as service } from '@ember/service';
import Evented from '@ember/object/evented';

export default Service.extend(Evented, {
  websockets: service(),

  _socketRef: null, //websocket to send/receive messages to/from backend
  _updateQueue: null, // Messages which are ready to be sent to backend
  
  host: null,
  port: null,

  /**
   * Establish a websocket connection and initialize needed handlers.
   * 
   * @param {string} host The host address.
   * @param {number} port The socket's port.
   */
  initSocket() {
    this.set('_updateQueue', []);
    const socket = this.get('websockets').socketFor(`ws://${this.get('host')}:${this.get('port')}/`);
    socket.on('open', this._openHandler, this);
    socket.on('message', this._messageHandler, this);
    socket.on('close', this._closeHandler, this);
    this.set('_socketRef', socket);
  },

  closeSocket() {
    this.get('websockets').closeSocketFor(`ws://${this.get('host')}:${this.get('port')}/`);
    // close handlers
    const socket = this.get('_socketRef');
    if(socket) {
      socket.off('open', this._openHandler);
      socket.off('message', this._messageHandler);
      socket.off('close', this._closeHandler);
    }
    this.set('_socketRef', null);
    this.set('_updateQueue', null);
  },

  _closeHandler( /* event */ ) {
    this.trigger('connection_closed');
  },

  // Called when the websocket is opened for the first time
  _openHandler( /* event */ ) {},

  _messageHandler(event) {
    // Backend could have sent multiple messages at a time
    const messages = JSON.parse(event.data); 
    for(let i = 0; i < messages.length; i++) {
      let data = messages[i];
      this.trigger(data.event, data)
    }
  },

  // Used to send messages to the backend
  send(obj) {
    if(this.get('_socketRef'))
      this.get('_socketRef').send(JSON.stringify(obj));
  },

  sendDisconnectRequest() {
    const disconnectMessage = [{
      "event": "receive_disconnect_request"
    }];
    this.send(disconnectMessage);
  },

  /**
   * Check wether there are messages in the update queue and send them to the backend.
   */
  sendUpdates() {
    // there are updates to send
    if(this.get('_updateQueue').length > 0) {
      this.send(this.get('_updateQueue'));
      this.set('_updateQueue', []);
    }
  },

  enqueue(JSONObj) {
    if(this.get('_updateQueue')) {
      this.get('_updateQueue').push(JSONObj);
    }
  },
});
