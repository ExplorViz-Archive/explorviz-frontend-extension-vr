import Menu from '../menu';
import { getOwner } from '@ember/application';
import EmberObject from '@ember/object';
import { inject as service } from "@ember/service";

export default EmberObject.extend({

  currentUser: service('user'),
  menu: null,
  
  showHint(hint, blinks, hint2) {
    const self = this;
    this.close(this.get('menu'));
    this.set('menu', Menu.create(getOwner(this).ownerInjection(), {
      name: 'hintMenu',
      resolution: { width: 512, height: 128 },
      size: { width: 0.2, height: 0.05 },
      opacity: 0.7,
      color: '#002e4f'
    }));
    if(hint2) {
      this.get('menu').addText(hint, 'text', 28, { x: 256, y: 25}, '#ffffff', 'center', false);
      this.get('menu').addText(hint2, 'text2', 28, { x: 256, y: 75}, '#ffff00', 'center', false);
    } else {
      this.get('menu').addText(hint, 'text', 28, { x: 256, y: 50}, '#ffffff', 'center', false);
    }
    this.get('menu').interact = (action) => {
      if(action === 'rightTriggerDown') {
        this.close(this.get('menu'));
      }
    };

    this.get('menu').createMesh();

    // move mesh to middle of the screen and set initial size to 0 (invisible)
    const mesh = this.get('menu').get('mesh');
    mesh.position.y -= 0.1;
    mesh.position.z -= 0.3;
    mesh.rotateX(-0.18);
    mesh.scale.x = 0;

    let thismenu = this.get('menu');
    let dir = 1;
    let moved = 0.0;
    let counter = 0;

    this.get('currentUser').getCamera().add(mesh);

    // menu's stretch-open animation
    function animateOpen() {
      if(!thismenu)
        return;

      moved += 0.05;
      if (moved >= 0 && moved < 1) {
        mesh.scale.x += 0.05;
      } else if (moved >= 1) {
        // if opened, make menu pulsate
        moved = 0;
        animatePulsation();
        return;
      }
      requestAnimationFrame(animateOpen);
    }
    // animates hint menu's pulsation effect
    function animatePulsation() {
      if(!thismenu)
        return;
      moved += 0.00075;
      if(counter < 2*blinks) {
        if (moved >= 0 && moved < 0.015) {
          mesh.position.z += dir * 0.00075;
        } else if (moved >= 0.015) {
          mesh.position.z += dir * 0.00075;
          dir *= -1;
          moved = 0;
          counter++;
        }
        requestAnimationFrame(animatePulsation);
      } else {
        // if pulsation done, close menu
        counter = 0;
        animateClose();
      }
    }
    // animtes menu closing animation, the reverse of the open animation
    // closes menu afterward
    function animateClose() {
      if(!thismenu)
        return;

      moved += 0.05;
      if (moved >= 0 && moved < 1) {
        mesh.scale.x -= 0.05;
      } else if (moved >= 1) {
        // if close animation done, actually close menu.
        moved = 0;
        self.close(thismenu);
        return;
      }
      requestAnimationFrame(animateClose);
    }
    animateOpen();
  },

  close(menu) {
    if(menu) {
      if(menu.get('mesh'))
        menu.get('mesh').parent.remove(menu.get('mesh'));
      menu.close();
      menu = null;
    }
  }
});