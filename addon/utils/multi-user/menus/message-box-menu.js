import Menu from '../menu';

let messageQueue = [];
let messageBox = null;
const timeBetweenMessages = 800;

/**
 * Add text to messageQueue which should be displayed on top edge of hmd
 * @param {{title: string, text: string, color: string}} message Title and text which should be displayed
 * @param {Number} time The number of milliseconds the message is displayed
 */
export function enqueueMessage(message, time) {
  messageQueue.unshift({message, time});
  if(messageQueue.length === 1) {
    showMessage.call(this);
  }
  /**
   * Displays text messages on the top edge of the hmd for 3 seconds
   */
  function showMessage() {
    if(messageQueue.length <= 0)
      return;
    
    let { message, time } = messageQueue[messageQueue.length-1];
    createMessageBox.call(this, message.title, message.text, message.color);
    setTimeout(closeAfterTime.bind(this), time);
    

    function createMessageBox(title, text, color) {
      messageBox = new Menu({
        title: 'messageBox',
        resolution: { width: 256, height: 64 },
        size: { width: 0.2, height: 0.05 },
        opacity: 0.7,
        color: '#000000',
      });

      if(!color)
        color = 'lightgreen';

      messageBox.addText(title, 'title', 18, { x: 128, y: 10}, '#ffffff', 'center', false);
      messageBox.addText(text, 'text', 14, { x: 128, y: 40}, color, 'center', false);
      messageBox.interact = (action, position) => {};

      messageBox.createMesh();
      this.menus.set(messageBox.title, messageBox);

      let textBox = messageBox.mesh;
      textBox.position.y += 0.3;
      textBox.position.z -= 0.3;
      textBox.rotateX(0.45);

      this.camera.add(textBox);
      let y = 0;
      function animate() {
        y -= 0.01;
        if (y > -0.16) {
          textBox.position.y -= 0.01;
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
        if(messageQueue.length > 0) {
          messageQueue.pop();
          showMessage.call(this);
        }
      }, timeBetweenMessages);
      
      /**
       * Remove text message on top edge of user's view
       */
      function deleteMessageBox() {
        this.camera.remove(messageBox.mesh);
        messageBox.close();
        this.menus.delete('messageBox');
        messageBox = null;
      }
    }
  }
}