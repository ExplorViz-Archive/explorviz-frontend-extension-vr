import Menu from '../menu';
import EmberObject from '@ember/object';
import { inject as service } from "@ember/service";
import { getOwner } from '@ember/application';

export default EmberObject.extend({

  messageQueue: null,
  messageBox: null,
  timeBetweenMessages: null,
  currentUser: service('user'),

  init() {
    this.set('messageQueue', []);
    this.set('timeBetweenMessages', 800);
  },
  
  /**
   * Add text to messageQueue which should be displayed on top edge of hmd.
   * 
   * @param {{title: string, text: string, color: string}} message Title and text which should be displayed.
   * @param {Number} time The number of milliseconds the message is displayed.
   */
  enqueueMessage(message, time) {
    this.get('messageQueue').unshift({message, time});
    if(this.get('messageQueue').length === 1) {
      showMessage.call(this);
    }
    /**
     * Displays text messages on the top edge of the hmd for 3 seconds
     */
    function showMessage() {
      if(this.get('messageQueue').length <= 0)
        return;
      
      let { message, time } = this.get('messageQueue')[this.get('messageQueue').length-1];
      createMessageBox.call(this, message.title, message.text, message.color);
      setTimeout(closeAfterTime.bind(this), time);
      
      function createMessageBox(title, text, color) {
        this.set('messageBox', Menu.create(getOwner(this).ownerInjection(), {
          title: 'messageBox',
          resolution: { width: 256, height: 64 },
          size: { width: 0.2, height: 0.05 },
          opacity: 0.7,
          color: '#000000'
        }));
  
        if(!color)
          color = 'lightgreen';
  
        this.get('messageBox').addText(title, 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
        this.get('messageBox').addText(text, 'text', 14, { x: 128, y: 40}, color, 'center', false);
        this.get('messageBox').interact = (action) => {
          if(action === 'rightTrigger') {
            close.call(this);
          }
        };
  
        this.get('messageBox').createMesh();
  
        const mesh = this.get('messageBox').get('mesh');
        mesh.position.y += 0.3;
        mesh.position.z -= 0.3;
        mesh.rotateX(0.45);
  
        this.get('currentUser').getCamera().add(mesh);
        let y = 0;
        function animate() {
          y -= 0.015;
          if (y > -0.195) {
            mesh.position.y -= 0.015;
          } else {
            return;
          }
          requestAnimationFrame(animate);
        }
        animate();
      }
  
      function closeAfterTime() {
        deleteMessageBox.call(this);
        setTimeout(() => {
          if(this.get('messageQueue').length > 0) {
            this.get('messageQueue').pop();
            showMessage.call(this);
          }
        }, this.get('timeBetweenMessages'));
        
        /**
         * Remove text message on top edge of user's view
         */
        function deleteMessageBox() {
          this.get('currentUser').getCamera().remove(this.get('messageBox').get('mesh'));
          this.get('messageBox').close();
          this.set('messageBox', null);
        }
      }
    }
  }
});