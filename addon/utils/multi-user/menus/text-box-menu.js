import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';
import BaseMenu from './menu-base';
import Menu from '../menu';

export default BaseMenu.extend({
  time: service(),
  currentUser: service('user'),

  /**
   * Creates and opens the Connect Menu.
   */
  open(content) {

    this.set('menu', Menu.create(getOwner(this).ownerInjection(), { 
      name: 'textBoxMenu',
      resolution: { width: 2*512/3*2, height: 1*512/3*2 },
      size: { width: 0.4, height: 0.2}
    }));
    

    this.get('menu').addRectangle({x: 0, y: 0}, 2*512/3*2, 66/3*2, '#777777');
    this.get('menu').addText(content.title, 'title', 26, { x: 2*256/3*2, y: 20/3*2}, '#ffffff', 'center', false);

    // Spilt up remaining canvas for each entry
    let offset = (1*512/3*2 - 66/3*2*1.5) / 3;

    let tempOffset = offset;

    // Position under line
    offset = 66/3*2*1.5;

    for (let key1 in content.innerContent) {
      let left = true;

      // Draw entry
      for (let key2 in content.innerContent[key1]) {
        // Draw content on the left (name)
        if (!left) {
          this.get('menu').addText(content.innerContent[key1][key2], '', 26, { x: 2*512/3*2-20, y: offset}, '#ffffff', 'right', false);
          left = true;
        }
        // Draw content on the right (value)
        else {
          this.get('menu').addText(content.innerContent[key1][key2], '', 26, { x: 20, y: offset}, '#ffffff', 'left', false);
          left = false;
        }
      }
      offset += tempOffset;
    }

    
    this.get('menu').createMesh();
    const mesh = this.get('menu.mesh');
    mesh.position.y += 0.065 + 0.005;
    mesh.position.z -= 0.115;
    mesh.geometry.rotateX(1.5707963267949 * 1.5);
    mesh.geometry.rotateY(1.5707963267949 * 2);
    mesh.geometry.rotateZ(1.5707963267949 * 2);
    this.get('user.primaryController').add(mesh);

  },

  close() {
    const menu = this.get('menu');
    if(menu) {
      menu.get('mesh').parent.remove(menu.get('mesh'));
      menu.close();
      this.set('menu', null);
    }
  }
});
