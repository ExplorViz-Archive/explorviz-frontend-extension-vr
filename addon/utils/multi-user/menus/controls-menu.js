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
  open(lastMenu) {
    this._super(lastMenu);

    this.set('menu', Menu.create(getOwner(this).ownerInjection(), { 
      name: 'controlsMenu',
      resolution: { width: 2*512, height: 1*512 },
      size: { width: 2*0.3, height: 1*0.3}
    }));
    

    this.get('menu').addRectangle({x: 0, y: 0}, 2*512, 66, '#777777');
    this.get('menu').addText('Controls', 'title', 36, { x: 2*256, y: 20}, '#ffffff', 'center', false);
    //this.get('menu').addTextButton('Back', 'back', { x: 2*100, y: 1.5*402 }, 316, 50, 28, '#555555', '#ffffff', '#929292', true);
    this.get('menu').addTextButton('Back', 'back', { x: 2*512 - 92, y: 13 }, 65, 40, 22, '#aaaaaa', '#ffffff', '#dc3b00', true);

    const factor = 1 / (3828 / (2 * 512 - 66)); 
    
    let controller = this.get('currentUser').get('primaryController').getGamepad().id;
    let url = null;

    if(!(controller === 'Oculus Touch (Right)' )) {
      url = 'images/oculus_controls.png';
    } else {
      url = 'images/vive_controls.png';
    }

    this.get('menu').addImage(url, 33, 99, factor * 3828, factor * 1392);
  
  
    this.get('menu').interact = (action, position) => {
      let item = this.get('menu').getItem(position);
      
      if(item) {

        if(action === 'rightIntersect' || action === 'rightTriggerDown') {
          this.get('menu').setHover(item);
        }
          if(action === 'rightTriggerDown') {
        
            if(item.name === 'back') {
              this.back();
           }
        }
      
      } else { 
        this.get('menu').setHover(null);
        this.get('menu').deactivateItems();
      }
    };
    
    this.get('menu').createMesh();
    //const mesh = this.get('menu.mesh');
    //mesh.position.z -= 0.7;
    //this.get('currentUser.camera').add(mesh);
    
    //const mesh = this.get('menu.mesh');
    //mesh.position.y += 0.11;
    //mesh.position.z -= 0.15;
    //mesh.position.x += 0.2;
    //mesh.geometry.rotateX(-0.785);
    this.addToSecondaryController();

  }
});
