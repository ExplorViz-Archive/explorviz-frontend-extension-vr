import EmberObject from '@ember/object';
import THREE from 'three';
import EmberMap from '@ember/map';

export default EmberObject.extend({
  title: null,
  width: null,
  height: null,
  items: null,
  color: new THREE.Color('rgb(255,255,255)'),
  opacity: 1.0,
  mesh: null,

  setTitle(title) {
    this.title = title;
  },

  addText(text, size, position, color, align) {
    if(!this.items)
      this.items = new Array();

    this.items.push({ type: 'text', text, size, position, color, align });
  },

  createMesh() {
    if(this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    let material = new THREE.MeshBasicMaterial({
      color: this.color
    });
    let textBox = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.05), material);
    textBox.name = this.title;

    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = this.width;
    this.get('canvas2').height = this.height;
    let canvas2 = this.get('canvas2');
    var ctx = canvas2.getContext('2d');
    ctx.fillStyle = `#${this.color.getHexString()}`;
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);


    console.log(this.items.length);
    for(let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      if(item.type === 'text') {
        // Draw Text
        ctx.font = `${item.size}px arial`;
        ctx.fillStyle = item.color;
        ctx.textAlign = item.align;
        ctx.fillText(item.text, item.position.x, item.position.y);
      }
    }
       
    // create texture out of canvas
    let texture = new THREE.Texture(canvas2);
    // Map texture
    material = new THREE.MeshBasicMaterial({map: texture, depthTest: true});
    material.transparent = true;
    material.opacity = this.opacity;

    // Update texture      
    texture.needsUpdate = true;
    // Update mesh material
    textBox.material = material;
    this.mesh = textBox;
  }

});