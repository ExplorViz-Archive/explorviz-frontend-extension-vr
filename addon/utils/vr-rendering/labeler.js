import Ember from 'ember';
import THREE from "npm:three";

/*
 * This util is used to draw the labels of the
 * landscape and application3D
 *
 */ 
export default Ember.Object.extend({

  systemTextCache: [],
  nodegroupTextCache: [],
  nodeTextCache: [],
  appTextCache: [],
  canvasList: {},
  textures: {},

  /*
   * This method stores the text and all additional information
   * into an array for each type of entity
   *
   */
  saveTextForLabeling(textToShow, parent, color, boxColor) {

    const emberModelName = parent.userData.model.constructor.modelName;
    const text = textToShow ? textToShow : parent.userData.model.get('name');

    let textCache = 'systemTextCache';
    // Identify entity type 
    if(emberModelName === "node"){
      textCache = 'nodeTextCache';
    }
    else if(textToShow){
      textCache = 'nodegroupTextCache';
    }
    else if(emberModelName === "application") {
      textCache = 'appTextCache';
    }

    this.get(textCache).push({text: text, parent: parent, color: color, boxColor: boxColor});

  },

  /*
   * This method is used to draw the labels 
   */
  drawTextLabels() {

    this.drawSystemTextLabels();
    this.drawNodeGroupTextLabels();
    this.drawNodeTextLabels();
    this.drawAppTextLabels();

    // After drawing, reset all caches for next tick
    this.set('systemTextCache', []);
    this.set('nodegroupTextCache', []);
    this.set('nodeTextCache', []);
    this.set('appTextCache', []);

  },

  /*
  * This method is used to redraw given entities.
  * Therefore the mapped material gets apated to the passed color.  
  * This method is called for changig the box color.
  *
  */
  redrawLabel(entity, textColor, name, color){

    // Create one canvas for each entity if not already exists
    if(!this.get('canvasList')[entity.id]){
      let canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;

      this.get('canvasList')[entity.id] = canvas;

      entity.geometry.computeBoundingBox();
      let bbox = entity.geometry.boundingBox;
      
      let size = bbox.getSize();
      
      // calculate aspect ratio and next power of 2 
      let nextPowerOf2X = Math.pow(2, Math.ceil(Math.log(size.x*40)/Math.log(2)));
      let nextPowerOf2Y = Math.pow(2, Math.ceil(Math.log(size.y*40)/Math.log(2)));

      // Adapt canvas to size of box
      this.get('canvasList')[entity.id].width = nextPowerOf2X;
      this.get('canvasList')[entity.id].height = nextPowerOf2Y;
    }


    let oldMaterial = new THREE.MeshBasicMaterial({color});

    let canvas = this.get('canvasList')[entity.id];
    var ctx = canvas.getContext('2d');

    var x, y, max;
    // Define the size and position of the label depending on the entity type
    if(entity.type === 'system'){
      if(entity.userData.model.get('opened')){
        ctx.font = '15px arial';
        y = canvas.height/16;
       
      }
      else{
        ctx.font = '32px arial';
        y = canvas.height/2;
      }
      x = canvas.width/2;
      max = canvas.width*0.95;
    
    }
    else if(entity.type === 'nodegroup'){
      if(!entity.userData.model.get('opened')){
        ctx.font = '30px arial';
        x = canvas.width/2;
        y = canvas.height/2;
        max = canvas.width*0.95;
      } 
 
    }
    else {
      ctx.font = '30px arial';
      x = canvas.width/2*0.8;
      y = canvas.height/2;
      max = canvas.width*0.5;

    }

    // Draw new box color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = textColor;
    
    ctx.textAlign = "center";
    ctx.fillText(name, x,y,max);
    
    // Look for existing texture
    if(!this.get('textures')[entity.id]){
      // create new texture out of canvas 
      this.get('textures')[entity.id] = new THREE.CanvasTexture(canvas);
    }

    let texture = this.get('textures')[entity.id];

    // map texture
    let canvasMaterial = new THREE.MeshBasicMaterial({map: texture});

    // Update texture      
    texture.needsUpdate = true;   

    // Define each side of the box
    var materials = [oldMaterial, // Right side
      oldMaterial, // Left side
      oldMaterial, // Back   
      oldMaterial, // Front
      canvasMaterial , // Top
      oldMaterial  // Buttom
    ];
      
    // Delete old material and texture
    canvasMaterial.map.dispose() 
    canvasMaterial.dispose();
    oldMaterial.dispose();
    texture.dispose();
    this.disposeMaterial(entity.material);

    // Set new material
    entity.material = materials;

  },

  /*
   * This method is used to label the box of a system and is
   * directly called after creating the box. 
   */
  drawSystemTextLabels() {

    this.get('systemTextCache').forEach((textObj) => {

      // Create one canvas for each entity
      if(!this.get('canvasList')[textObj.parent.id]){
        let canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 32;
        this.get('canvasList')[textObj.parent.id] = canvas;
      }

      textObj.parent.geometry.computeBoundingBox();
      let bbox = textObj.parent.geometry.boundingBox;
      
      let size = bbox.getSize();
      
      // calculate aspect ratio and next power of 2 
      let nextPowerOf2X = Math.pow(2, Math.ceil(Math.log(size.x*40)/Math.log(2)));
      let nextPowerOf2Y = Math.pow(2, Math.ceil(Math.log(size.y*40)/Math.log(2)));

      // Adapt canvas to size of box
      this.get('canvasList')[textObj.parent.id].width = nextPowerOf2X;
      this.get('canvasList')[textObj.parent.id].height = nextPowerOf2Y;
      
      // get entity color and material
      let color = textObj.boxColor;

      let canvas = this.get('canvasList')[textObj.parent.id];
    
      var ctx = canvas.getContext('2d');

      // Draw old box color
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Handle opened and closed systems
      if(textObj.parent.userData.model.get('opened')){
        // Draw title for opened systems
        ctx.font = '20px arial';
        ctx.fillStyle = textObj.color;
        ctx.textAlign = "center";
        ctx.fillText(textObj.text, canvas.width/2,20,canvas.width*0.95);
      }
      else{
        // Draw title for closed systems
        ctx.font = '32px arial';
        ctx.fillStyle = textObj.color;
        ctx.textAlign = "center";
        ctx.fillText(textObj.text, canvas.width/2,canvas.height/2,canvas.width*0.95);
      }

      // create texture out of canvas
      if(!this.get('textures')[textObj.parent.id]){
        this.get('textures')[textObj.parent.id] = new THREE.CanvasTexture(canvas);

      }

      let texture = this.get('textures')[textObj.parent.id];
      // map texture
      let canvasMaterial = new THREE.MeshBasicMaterial({map: texture});

      // Update texture      
      texture.needsUpdate = true;
      // Update mesh material    
    
      // use old material
      let oldMaterial = textObj.parent.material;

      // Define each side of the box
      var materials = [oldMaterial, // Right side
        oldMaterial, // Left side
        oldMaterial, // Back   
        oldMaterial, // Front
        canvasMaterial, // Top
        oldMaterial // Buttom
      ];

      // Delete old material and texture
      texture.dispose();
      canvasMaterial.dispose();
      oldMaterial.dispose();
      this.disposeMaterial(textObj.parent.material);
    
      // Set new material
      textObj.parent.material = materials;

    });
  },

  disposeMaterial(material){
    if(material.length){
      for (let i = 0; i < material.length; i++) {
        material[i].dispose();
      }
    }
    else{
      material.dispose();
    } 
  },

  /*
   * This method is used to label the box of a nodegroup and is
   * directly called after creating the box. 
   */
  drawNodeGroupTextLabels() {

    this.get('nodegroupTextCache').forEach((textObj) => {

      // Create one canvas for each entity
      if(!this.get('canvasList')[textObj.parent.id]){
        let canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 32;
        this.get('canvasList')[textObj.parent.id] = canvas;
      }

      textObj.parent.geometry.computeBoundingBox();
      let bbox = textObj.parent.geometry.boundingBox;
      
      let size = bbox.getSize();
      
      // calculate aspect ratio and next power of 2 
      let nextPowerOf2X = Math.pow(2, Math.ceil(Math.log(size.x*30)/Math.log(2)));
      let nextPowerOf2Y = Math.pow(2, Math.ceil(Math.log(size.y*40)/Math.log(2)));

      // Adapt canvas to size of box
      this.get('canvasList')[textObj.parent.id].width = nextPowerOf2X;
      this.get('canvasList')[textObj.parent.id].height = nextPowerOf2Y;

      // get entity color and material
      let color = textObj.boxColor;

      let canvas = this.get('canvasList')[textObj.parent.id];
    
      var ctx = canvas.getContext('2d');

      // Draw old box color
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Handle opened nodegroups
      if(!textObj.parent.userData.model.get('opened')){
        // Draw title for opened nodegroups
        ctx.font = '30px arial';
        ctx.fillStyle = textObj.color;
        ctx.textAlign = "center";
        ctx.fillText(textObj.text, canvas.width/2,canvas.height/2,canvas.width*0.95);
      }

      // create texture out of canvas
      if(!this.get('textures')[textObj.parent.id]){
        this.get('textures')[textObj.parent.id] = new THREE.CanvasTexture(canvas);

      }

      let texture = this.get('textures')[textObj.parent.id];
      // map texture
      let canvasMaterial = new THREE.MeshBasicMaterial({map: texture});

      // Update texture      
      texture.needsUpdate = true;
      // Update mesh material    
    
      // use old material
      let oldMaterial = new THREE.MeshBasicMaterial({
        color
      });
      
      // Define each side of the box
      var materials = [oldMaterial, // Right side
        oldMaterial, // Left side
        oldMaterial, // Back   
        oldMaterial, // Front
        canvasMaterial, // Top
        oldMaterial  // Buttom
      ];

      // Delete old material and texture
      texture.dispose();
      canvasMaterial.dispose();
      oldMaterial.dispose();
      this.disposeMaterial(textObj.parent.material);
      
      // Set new material
      textObj.parent.material = materials;

    });
  },

  /*
   * This method is used to label the box of a node and is
   * directly called after creating the box. 
   */
  drawNodeTextLabels() {

    this.get('nodeTextCache').forEach((textObj) => {

      // Create one canvas for each entity
      if(!this.get('canvasList')[textObj.parent.id]){
        let canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 32;
        this.get('canvasList')[textObj.parent.id] = canvas;
      }

      textObj.parent.geometry.computeBoundingBox();
      let bbox = textObj.parent.geometry.boundingBox;
      
      let size = bbox.getSize();
      
      // calculate aspect ratio and next power of 2 
      let nextPowerOf2X = Math.pow(2, Math.ceil(Math.log(size.x*40)/Math.log(2)));
      let nextPowerOf2Y = Math.pow(2, Math.ceil(Math.log(size.y*80)/Math.log(2)));

       // Adapt canvas to size of box
      this.get('canvasList')[textObj.parent.id].width = nextPowerOf2X;
      this.get('canvasList')[textObj.parent.id].height = nextPowerOf2Y;
      
      // get entity color
      let color = textObj.boxColor;
      
      let canvas = this.get('canvasList')[textObj.parent.id];
    
      var ctx = canvas.getContext('2d');

      // Draw old box color
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    
      // Draw title for nodes
      ctx.font = '25px arial';
      ctx.fillStyle = textObj.color;
      ctx.textAlign = "center";
      ctx.textBaseline="bottom";
      ctx.fillText(textObj.text, canvas.width/2,canvas.height*0.9,canvas.width*0.9);
      

      // create texture out of canvas
      if(!this.get('textures')[textObj.parent.id]){
        this.get('textures')[textObj.parent.id] = new THREE.CanvasTexture(canvas);

      }

      let texture = this.get('textures')[textObj.parent.id];
      // map texture
      let canvasMaterial = new THREE.MeshBasicMaterial({map: texture});

      // Update texture      
      texture.needsUpdate = true;
      // Update mesh material    
    
      // use old material
      let oldMaterial = new THREE.MeshBasicMaterial({
        color
      });
      
      // Define each side of the box
      var materials = [oldMaterial, // Right side
        oldMaterial, // Left side
        oldMaterial, // Back   
        oldMaterial, // Front
        canvasMaterial, // Top
        oldMaterial  // Buttom
      ];

      // Delete old material and texture
      texture.dispose();
      this.disposeMaterial(textObj.parent.material);
      canvasMaterial.dispose();
      oldMaterial.dispose();
      
      // set new material
      textObj.parent.material = materials;
    });
  },

  /*
   * This method is used to label the box of an application and is
   * directly called after creating the box. 
   */
  drawAppTextLabels() {
    this.get('appTextCache').forEach((textObj) => {

      // Create one canvas for each entity
      if(!this.get('canvasList')[textObj.parent.id]){
        let canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 32;
        this.get('canvasList')[textObj.parent.id] = canvas;
      }
      textObj.parent.geometry.computeBoundingBox();
      let bbox = textObj.parent.geometry.boundingBox;
      
      let size = bbox.getSize();
      
      // calculate aspect ratio and next power of 2 
      let nextPowerOf2X = Math.pow(2, Math.ceil(Math.log(size.x*75)/Math.log(2)));
      let nextPowerOf2Y = Math.pow(2, Math.ceil(Math.log(size.y*90)/Math.log(2)));

       // Adapt canvas to size of box
      this.get('canvasList')[textObj.parent.id].width = nextPowerOf2X;
      this.get('canvasList')[textObj.parent.id].height = nextPowerOf2Y;
      
      // get entity color and material
      let color = textObj.boxColor;

      let canvas = this.get('canvasList')[textObj.parent.id];
    
      var ctx = canvas.getContext('2d');

      // Draw old box color
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    
      // Draw title for nodes
      ctx.font = '30px arial';
      ctx.fillStyle = textObj.color;
      ctx.textAlign = "center";
      // save some space for images (canvas.width/2-6)
      ctx.fillText(textObj.text, canvas.width/2*0.8,canvas.height/2,canvas.width*0.5);
      

      // create texture out of canvas
      if(!this.get('textures')[textObj.parent.id]){
        this.get('textures')[textObj.parent.id] = new THREE.CanvasTexture(canvas);

      }

      let texture = this.get('textures')[textObj.parent.id];
      // map texture
      let canvasMaterial = new THREE.MeshBasicMaterial({map: texture});

      // Update texture      
      texture.needsUpdate = true;
      // Update mesh material    
    
      // use old material
      let oldMaterial = new THREE.MeshBasicMaterial({
        color
      });
      
      // Define each side of the box
      var materials = [oldMaterial, // Right side
        oldMaterial, // Left side
        oldMaterial, // Back   
        oldMaterial, // Front
        canvasMaterial, // Top
        oldMaterial  // Buttom
      ];

      // Delete old material and texture
      texture.dispose();
      canvasMaterial.dispose();
      oldMaterial.dispose();
      this.disposeMaterial(textObj.parent.material);
      
      // set new material
      textObj.parent.material = materials;

    });

  },

});
