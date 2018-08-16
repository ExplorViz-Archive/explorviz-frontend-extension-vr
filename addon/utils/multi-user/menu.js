import EmberObject from '@ember/object';
import THREE from 'three';

export default EmberObject.extend({
  title: null,
  resolution: null,
  size: null,
  items: null,
  color: '#FFFFFF',
  opacity: 1.0,
  mesh: null,
  hoverColor: '#00FFFF',
  hoveredItem: null,

  Menu(options) {
    if(options.title)
      this.title = options.title;
    if(options.resolution)
      this.resolution = options.resolution;
    if(options.size)
      this.size = options.size;
    if(options.opacity)
      this.opacity = options.opacity;
    if(options.color)
      this.color = options.color;
  },
  
  addText(text, name, size, position, color, align, clickable) {
    if(!this.items)
      this.items = new Array();

    this.items.push({ type: 'text', name, text, size, position, color, align, clickable, hover: false });
  },

  addButton(width, height, position, color) {
    if(!this.items)
      this.items = new Array();

    this.items.push({ type: 'button', width, height, position, color });
  },
  
  addArrowButton(name, position, to, style, color) {
    if(!this.items)
      this.items = new Array();

    this.items.push({ type: 'button', style, name, position, to, color });
  },

  update() {
    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = this.resolution.width;
    this.get('canvas2').height = this.resolution.height;
    let canvas2 = this.get('canvas2');
    var ctx = canvas2.getContext('2d');
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);

    for(let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      if(item.type === 'text') {
        // Draw Text
        ctx.font = `${item.size}px arial`;
        if(item.clickable && item.hover) {
          ctx.fillStyle = this.hoverColor;
        } else {
          ctx.fillStyle = item.color;
        }
        ctx.textAlign = item.align;
        let textSize = this.getTextSize(item.text, ctx.font);
        ctx.fillText(item.text, item.position.x, item.position.y + textSize.sublineHeight);
      } else if(item.type === 'button') {
        if(item.style.startsWith('arrow')) {
          if(item.hover) {
            ctx.fillStyle = this.hoverColor;
          } else {
            ctx.fillStyle = item.color;
          }
          this.drawArrowhead(ctx, item.position, item.to, item.style);
        }
      }
    }
       
    // create texture out of canvas
    let texture = new THREE.CanvasTexture(canvas2);
    // Map texture
    let material = new THREE.MeshBasicMaterial({map: texture, depthTest: true});
    material.transparent = true;
    material.opacity = this.opacity;

    // Update texture      
    texture.needsUpdate = true;
    // Update mesh material
    this.mesh.material = material;
  },

  updateText(itemName, text) {
    for(let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if(item.name === itemName) {
        item.text = text;
        this.update();
        break;
      }
    }
  },

  drawArrowhead(ctx, from, to, style) {
    switch(style) {
      case 'arrow_up':
        ctx.beginPath();
        ctx.moveTo(from.x, to.y);
        ctx.lineTo(from.x + ((to.x - from.x) / 2), from.y);
        ctx.lineTo(to.x, to.y);
        ctx.fill();
        break;
      case 'arrow_down':
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, from.y);
        ctx.lineTo(from.x + ((to.x - from.x) / 2), to.y);
        ctx.fill();
        break;
    }
  },

  close() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
  },

  getItem(position) {
    for(let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      let x = this.resolution.width * position.x;
      let y = this.resolution.height - (this.resolution.height * position.y);
      if(item.type === 'text') {

        let size = this.getTextSize(item.text, `${item.size}px arial`);

        let itemX = item.position.x;
        let itemY = item.position.y;

        if(item.align === 'center') {
          itemX -= size.width / 2;
        } else if(item.align === 'right') {
          itemX -= size.width;
        }

        if(x >= itemX && y >= itemY && x <= itemX + size.width && y <= itemY + size.height) {
          return item;
        }
      } else if(item.type === 'button') {
        if(item.style.startsWith('arrow')) {
          let itemX = item.position.x;
          let itemY = item.position.y;

          if(x >= itemX && y >= itemY && x <= itemX + (item.to.x - item.position.x) && y <= itemY  + (item.to.y - item.position.y)) {
            return item;
          }
        }
      }
    }
  },
  
  /**
  * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
  * 
  * @param {String} text The text to be rendered.
  * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
  * 
  * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
  */
  getTextSize(text, font) {
    // re-use canvas object for better performance
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");
    context.font = font;
    let width = context.measureText(text).width;
    let height = context.measureText("W").width;
    var sublineHeight = context.measureText("H").width;
    return { width, height, sublineHeight };
  },

  setHover(item) {    
    if(item === null && this.hoveredItem) {
      this.hoveredItem.hover = false;
      this.hoveredItem = null;
      this.update();
      return;
    }

    if(item === this.hoveredItem )
      return;

    if(this.hoveredItem) {
      this.hoveredItem.hover = false;
    }
    this.hoveredItem = item;
    this.hoveredItem.hover = true;

    this.update();

  },

  createMesh() {
    if(this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    let material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.color)
    });
    let textBox = new THREE.Mesh(new THREE.PlaneGeometry(this.size.width, this.size.height), material);
    textBox.name = this.title;

    this.set('canvas2', document.createElement('canvas'));
    this.get('canvas2').width = this.resolution.width;
    this.get('canvas2').height = this.resolution.height;
    let canvas2 = this.get('canvas2');
    var ctx = canvas2.getContext('2d');
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, canvas2.width, canvas2.height);


    for(let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      if(item.type === 'text') {
        // Draw Text
        ctx.font = `${item.size}px arial`;
        if(item.clickable && item.hover) {
          ctx.fillStyle = this.hoverColor;
        } else {
          ctx.fillStyle = item.color;
        }
        ctx.textAlign = item.align;
        let textSize = this.getTextSize(item.text, ctx.font);
        ctx.fillText(item.text, item.position.x, item.position.y + textSize.sublineHeight);
      } else if(item.type === 'button') {
        if(item.style.startsWith('arrow')) {
          if(item.hover) {
            ctx.fillStyle = this.hoverColor;
          } else {
            ctx.fillStyle = item.color;
          }
          this.drawArrowhead(ctx, item.position, item.to, item.style);
        }
      }
    }
       
    // create texture out of canvas
    let texture = new THREE.CanvasTexture(canvas2);
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