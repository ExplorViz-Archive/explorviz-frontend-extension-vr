import Service, { inject as service } from '@ember/service';

export default Service.extend({

    websockets: service('websockets'),
    socketRef: null,
  
    init() {
      this._super(...arguments);
    },
  
    connect() {
      const socket = this.websockets.socketFor('ws://localhost:4444');
  
      console.log('Socket is now running');
  
      function myOpenHandler(event) {
        console.log(`On open event has been called: ${event}`);
        this.get('socketRef').send(JSON.stringify({
          broadcast: "Hello all"
        }));
      }
  
      function myMessageHandler(event) {
        console.log(`Message: ${event.data}`);
      }
  
      function myCloseHandler(event) {
        console.log(`On close event has been called: ${event}`);
      }
  
      socket.on('open', myOpenHandler, this);
      socket.on('message', myMessageHandler, this);
      socket.on('close', myCloseHandler, this);
  
      this.set('socketRef', socket);
    },
  
    willDestroyElement() {
      this._super(...arguments);
  
      const socket = this.socketRef;
  
      socket.off('open', this.myOpenHandler);
      socket.off('message', this.myMessageHandler);
      socket.off('close', this.myCloseHandler);
    }
  
});
