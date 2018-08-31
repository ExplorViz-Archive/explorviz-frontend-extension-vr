import EmberObject from '@ember/object';
import THREE from 'three';
import Helper from './helper';
import Menus from './menus';

export default EmberObject.extend({
  title: null,
  resolution: { width: 512, height: 512 },
  size: { height: 0.3, width: 0.3},
  items: null,
  color: '#444444',
  opacity: 0.8,
  mesh: null,
  hoverColor: '#00e5ff',
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
    if(!this.get('items'))
      this.set('items', new Array());

    color = color || '#ffffff';
    align = align || 'left';
    clickable = clickable || false;

    this.get('items').push({ type: 'text', name, text, size, position, color, align, clickable, hover: false });
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
    if(!this.get('items'))
      this.set('items', new Array());

    style = style || 'arrow_right';
    color = color || '#ffffff';

    this.get('items').push({ type: 'button', style, name, position, to, color, hover: false });
  },
  
  /**
   * Add a clickable arrow button to the menu.
   * @example
   * let menu = new Menu();
   * 
   * menu.addCurvedArrowButton('rotate_right', {x: 10, y: 10}, {x: 20, y: 20}, 'curved_arrow_right', '#d3f4aa');
   * 
   * @param {string} name  - A unique identifier, ecspecially used for interactions.
   * @param {{x: number, y: number}} position - The diameter of the arrow.
   * @param {{x: number, y: number}} size - The lower right corner position of button.
   * @param {string} [style='curved_arrow_left'] - The style of the curved arrow.
   * @param {string} [color='#ffffff'] - The text's color in hexadecimal.
   */
  addCurvedArrowButton(name, position, size, style, color) {
    if(!this.get('items'))
      this.set('items', new Array());

    style = style || 'curved_arrow_left';
    color = color || '#ffffff';

    this.get('items').push({ type: 'button', style, name, position, size, color, hover: false });
  },

  addTextButton(text, name, position, width, height, textSize, buttonColor, textColor, hoverColor, clickable) {
    if(!this.get('items'))
      this.set('items', new Array());

    this.get('items').push({ type: 'textButton', name, text, position, width, height, textSize, buttonColor, textColor, hoverColor, clickable, hover: false });
  },

  addRectangle(position, width, height, color) {
    if(!this.get('items'))
      this.set('items', new Array());

    this.get('items').push({ type: 'background', position, width, height, color});
  },

  /**
   * Completely redraws the menu and creates a new and updates THREE.Mesh.
   */
  update() {
    if(!this.get('canvas')) {
      this.set('canvas', document.createElement('canvas'));
    }
    this.get('canvas').width = this.get('resolution.width');
    this.get('canvas').height = this.get('resolution.height');
    let canvas = this.get('canvas');
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for(let i = 0; i < this.get('items').length; i++) {
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
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else if(item.type === 'button') {
        if(item.style.startsWith('curved_arrow_')) {
          if(item.hover) {
            ctx.fillStyle = this.get('hoverColor');
            ctx.strokeStyle = this.get('hoverColor');
          } else {
            ctx.fillStyle = item.color;
            ctx.strokeStyle = item.color;
          }
          this.drawCurvedArrow(ctx, item.position, item.size, item.style);
        } else if(item.style.startsWith('arrow_')) {
          if(item.hover) {
            ctx.fillStyle = this.get('hoverColor');
          } else {
            ctx.fillStyle = item.color;
          }
          this.drawArrowhead(ctx, item.position, item.to, item.style);
        }
      } else if(item.type === 'textButton') {
        // draw button background
        if(item.clickable && item.hover)
          ctx.fillStyle = item.hoverColor;
        else
          ctx.fillStyle = item.buttonColor;

        ctx.fillRect(item.position.x, item.position.y, item.width, item.height);

        // draw button text
        ctx.fillStyle = item.textColor;
        ctx.font = `${item.textSize}px arial`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        let textSize = Helper.getTextSize(item.text, ctx.font);
        ctx.fillText(item.text, item.position.x + (item.width / 2), item.position.y + ((item.height + textSize.sublineHeight) / 2));
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

      } else if(item.type === 'background') {
        ctx.fillStyle = item.color;
        ctx.fillRect(item.position.x, item.position.y, item.width, item.height);
      }
    }
       
    // create texture out of canvas
    let texture = new THREE.CanvasTexture(canvas);
    // Map texture
    let material = new THREE.MeshBasicMaterial({ map: texture, depthTest: true });
    material.transparent = true;
    material.opacity = this.opacity;

    // Update texture      
    texture.needsUpdate = true;
    // Update mesh material
    this.get('mesh').material = material;
  },

  /**
   * Changes the text of a text item and updates the mesh.
   * 
   * @param {string} itemName - The unique identifier of the item.
   * @param {string} text - The new text of the item.
   */
  updateText(itemName, text) {
    for(let i = 0; i < this.get('items').length; i++) {
      const item = this.get('items')[i];
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
   * Draw a curved right/left arrow to a canvas.
   * @example
   * let canvas = document.createElement('canvas');
   * let ctx = canvas.getContext('2d');
   * 
   * drawCurvedArrow(ctx, {x: 30, y: 50}, 20, 'curved_arrow_left');
   * 
   * @param {Object} ctx - The context of a canvas.
   * @param {{x: number, y: number}} from - The upper left position of the arrow.
   * @param {number} size - The size of the arrow in both x and y direction.
   * @param {string} style - The style of the arrow.
   */
  drawCurvedArrow(ctx, from, size, style) {
    const x = (size / 2) + from.x;
    const y = (size / 2) + from.y;
    const radius = (size / 2) - (size / 8);
    let startAngle;
    let endAngle;
    if(style === 'curved_arrow_left') {
      startAngle = 0.0 * Math.PI;
      endAngle = 1.3 * Math.PI;
    } else if(style === 'curved_arrow_right') {
      startAngle = 0.7 * Math.PI;
      endAngle = 2.0 * Math.PI;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle, false);
    ctx.lineWidth = radius / 2;

    // line color
    ctx.stroke();

    if(style === 'curved_arrow_left') {
      const arrowSize = size / 2.5;
      const upperPos = {x: from.x + size - (radius / 3) - (arrowSize / 2), y: from.y + (size / 2) - (arrowSize / 1.2)};
      this.drawArrowhead(ctx, upperPos, {x: upperPos.x + arrowSize, y: upperPos.y + arrowSize}, 'arrow_up');
    } else if(style === 'curved_arrow_right') {
      const arrowSize = size / 2.5;
      const upperPos = {x: from.x + size - (radius / 3) - (arrowSize / 2), y: from.y + (size / 2) - (arrowSize * 0.2)};
      this.drawArrowhead(ctx, upperPos, {x: upperPos.x + arrowSize, y: upperPos.y + arrowSize}, 'arrow_down');
    }
  },

  /**
   * Remove the menu mesh.
   */
  close() {
    if(this.get('mesh')) {
      this.get('mesh').geometry.dispose();
      this.get('mesh').material.dispose();
      this.set('mesh', null);
    }
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
    for(let i = 0; i < this.get('items').length; i++) {
      let item = this.get('items')[i];
      let x = this.get('resolution.width') * position.x;
      let y = this.get('resolution.height') - (this.get('resolution.height') * position.y);
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
        if(item.style.startsWith('arrow_')) {
          let itemX = item.position.x;
          let itemY = item.position.y;

          if(x >= itemX && y >= itemY && x <= itemX + (item.to.x - item.position.x) && y <= itemY  + (item.to.y - item.position.y)) {
            return item;
          }
        } else if(item.style.startsWith('curved_arrow_')) {
          let itemX = item.position.x;
          let itemY = item.position.y;

          if(x >= itemX && y >= itemY && x <= itemX + item.size && y <= itemY  + item.size) {
            return item;
          }
        }
      } else if(item.type === 'textButton') {
        let itemX = item.position.x;
        let itemY = item.position.y;

        if(x >= itemX && y >= itemY && x <= itemX + item.width && y <= itemY  + item.height)
          return item;
      }
    }
  },

  /**
   * Enables hover effect for given item and disabled it for the formerly hovered item.
   * 
   * @param {Object} item - Menu item that shall the hovered.
   */
  setHover(item) {    
    if(item === null && this.get('hoveredItem')) {
      this.set('hoveredItem.hover', false);
      this.set('hoveredItem', null);
      this.update();
      return;
    }

    if(item === this.get('hoveredItem'))
      return;

    if(this.get('hoveredItem')) {
      this.set('hoveredItem.hover', false);
    }
    this.set('hoveredItem', item);
    this.set('hoveredItem.hover', true);

    this.update();

  },

  /**
   * Make a menu item clickable or unclickable.
   * 
   * @param {string} itemName - The identifier of the menu item.
   * @param {boolean} bool - Makes item clickable if true, unclickable if false.
   */
  setClickable(itemName, bool) {
    for(let i = 0; i < this.get('items').length; i++) {
      const item = this.get('items')[i];
      if(item.name === itemName) {
        item.clickable = bool;
        this.update();
        break;
      }
    }
  },

  /**
   * Change the color of a menu item.
   * 
   * @param {string} itemName - The identifier of the menu item.
   * @param {string} color - The new color of the item as hex string.
   */
  setColor(itemName, color) {
    for(let i = 0; i < this.get('items').length; i++) {
      const item = this.get('items')[i];
      if(item.name === itemName) {
        if(item.type === 'textButton')
          item.textColor = color;
        else
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
    if(this.get('mesh')) {
      return;
    }

    let material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.get('color'))
    });
    let textBox = new THREE.Mesh(new THREE.PlaneGeometry(this.get('size.width'), this.get('size.height')), material);
    textBox.name = this.get('title');
    this.set('mesh', textBox);

    this.update();
    Menus.add(this);
  },


  /**
   * Returns menu mesh.
   */
  getMesh() {
    return this.get('mesh');
  },

  /**
   * Returns the menu title.
   */
  getTitle() {
    return this.get('title');
  }

});