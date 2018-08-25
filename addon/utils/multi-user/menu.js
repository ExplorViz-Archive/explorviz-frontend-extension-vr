import EmberObject from '@ember/object';
import THREE from 'three';
import Helper from './helper';
import Menus from './menus';

export default EmberObject.extend({
  title: null,
  resolution: { width: 256, height: 256 },
  size: { height: 0.3, width: 0.3},
  items: null,
  color: '#444444',
  opacity: 0.8,
  mesh: null,
  hoverColor: '#00e5ff',
  color: '#444444',
  hoveredItem: null,
  canvas: null,
  
  /**
   * Adds a new text to the menu.
   * @example
   * let menu = new Menu();
   * 
   * menu.addText('Hello World', 'title', 18, {x: 50 y: 10}, '#a412b6', 'center');
   * 
   * @param {string} text - The text to display in the menu.
   * @param {string} name - A unique identifier, ecspecially used for interactions.
   * @param {number} size - Font size.
   * @param {{x: number, y: number}} position - The upper left corner position of text.
   * @param {string} [color='#ffffff'] - The text's color in hexadecimal.
   * @param {string} [align='left'] - Specifies whether the text is aligned to the left, center or right.
   * @param {boolean} [clickable=false] - If true, the text can the used for interactions and changes color on hover.
   */
  addText(text, name, size, position, color, align, clickable) {
    if(!this.items)
      this.items = new Array();

    color = color || '#ffffff';
    align = align || 'left';
    clickable = clickable || false;

    this.items.push({ type: 'text', name, text, size, position, color, align, clickable, hover: false });
  },
  
  /**
   * Add a clickable arrow button to the menu.
   * @example
   * let menu = new Menu();
   * 
   * menu.addArrowButton('next_user', {x: 10, y: 10}, {x: 20, y: 20}, 'arrow_right', '#d3f4aa');
   * 
   * @param {string} name  - A unique identifier, ecspecially used for interactions.
   * @param {{x: number, y: number}} position - The upper left corner position of button.
   * @param {{x: number, y: number}} to - The lower right corner position of button.
   * @param {string} [style='arrow_right'] - The style of the arrow.
   * @param {string} [color='#ffffff'] - The text's color in hexadecimal.
   */
  addArrowButton(name, position, to, style, color) {
    if(!this.items)
      this.items = new Array();

    style = style || 'arrow_right';
    color = color || '#ffffff';

    this.items.push({ type: 'button', style, name, position, to, color });
  },

  /**
   * Completely redraws the menu and creates a new and updates THREE.Mesh.
   */
  update() {
    if(!this.get('canvas')) {
      this.set('canvas', document.createElement('canvas'));
    }
    this.get('canvas').width = this.resolution.width;
    this.get('canvas').height = this.resolution.height;
    let canvas = this.get('canvas');
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        let textSize = Helper.getTextSize(item.text, ctx.font);
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
    let texture = new THREE.CanvasTexture(canvas);
    // Map texture
    let material = new THREE.MeshBasicMaterial({map: texture, depthTest: true});
    material.transparent = true;
    material.opacity = this.opacity;

    // Update texture      
    texture.needsUpdate = true;
    // Update mesh material
    this.mesh.material = material;
  },

  /**
   * Changes the text of a text item and updates the mesh.
   * 
   * @param {string} itemName - The unique identifier of the item.
   * @param {string} text - The new text of the item.
   */
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

  /**
   * Draw an arrow to a canvas.
   * @example
   * let canvas = document.createElement('canvas');
   * let ctx = canvas.getContext('2d');
   * 
   * drawArrowHead(ctx, {x: 30, y: 50}, {x: 40, y: 65}, 'arrow_up');
   * 
   * @param {Object} ctx - The context of a canvas.
   * @param {{x: number, y: number}} from - The upper left position of the arrow.
   * @param {{x: number, y: number}} to - The lower right position  of the arrow.
   * @param {string} style - The style of the arrow.
   */
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
      case 'arrow_left':
        ctx.beginPath();
        ctx.moveTo(to.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.lineTo(from.x, from.y + ((to.y - from.y) / 2));
        ctx.fill();
        break;
      case 'arrow_right':
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(from.x, to.y);
        ctx.lineTo(to.x, from.y + ((to.y - from.y) / 2));
        ctx.fill();
        break;
    }
  },

  /**
   * Remove the menu mesh.
   */
  close() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
    Menus.remove(this.getTitle());
  },

  /**
   * Finds the menu item at given uv position.
   * 
   * @param {{x: number, y: number}} position - The uv position.
   * 
   * @returns Item at given position if there is one, else undefined.
   */
  getItem(position) {
    for(let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      let x = this.resolution.width * position.x;
      let y = this.resolution.height - (this.resolution.height * position.y);
      if(item.type === 'text' && item.clickable) {

        let size = Helper.getTextSize(item.text, `${item.size}px arial`);

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
   * Enables hover effect for given item and disabled it for the formerly hovered item.
   * 
   * @param {Object} item - Menu item that shall the hovered.
   */
  setHover(item) {    
    if(item === null && this.hoveredItem) {
      this.hoveredItem.hover = false;
      this.hoveredItem = null;
      this.update();
      return;
    }

    if(item === this.hoveredItem)
      return;

    if(this.hoveredItem) {
      this.hoveredItem.hover = false;
    }
    this.hoveredItem = item;
    this.hoveredItem.hover = true;

    this.update();

  },

  setClickable(itemName, bool) {
    for(let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if(item.name === itemName && item.type === 'text') {
        item.clickable = bool;
        this.update();
        break;
      }
    }
  },

  setColor(itemName, color) {
    for(let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if(item.name === itemName) {
        item.color = color;
        this.update();
        break;
      }
    }
  },

  /**
   * Creates THREE.Mesh of the menu.
   */
  createMesh() {
    if(this.mesh) {
      return;
    }

    let material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.color)
    });
    let textBox = new THREE.Mesh(new THREE.PlaneGeometry(this.size.width, this.size.height), material);
    textBox.name = this.title;
    this.mesh = textBox;

    this.update();
    Menus.add(this);
  },


  /**
   * Returns menu mesh.
   */
  getMesh() {
    return this.mesh;
  },

  /**
   * Returns the menu title.
   */
  getTitle() {
    return this.title;
  }

});