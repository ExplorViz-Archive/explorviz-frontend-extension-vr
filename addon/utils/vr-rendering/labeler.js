import Ember from 'ember';
import THREE from "npm:three";

export default Ember.Object.extend({


  ///// Application labeling

  labels: [],

  textMaterialWhite: new THREE.MeshBasicMaterial({
    color : 0xffffff
  }),

  textMaterialBlack: new THREE.MeshBasicMaterial({
    color : 0x000000
  }),

  createLabel(parentMesh, parentObject, font) {

    const bboxNew = new THREE.Box3().setFromObject(parentMesh);

    const worldParent = new THREE.Vector3();
    worldParent.setFromMatrixPosition(parentMesh.matrixWorld);

    const oldLabel = this.get('labels').filter(function(label) {
      const data = label.userData;

      return data.name === parentMesh.userData.name && 
      label.userData.parentPos.equals(worldParent);
    });

    // check if TextGeometry already exists
    if (oldLabel && oldLabel[0]) {
      parentObject.add(oldLabel[0]);
      return;
    }

    // new TextGeometry necessary
    else {

      var fontSize = 2;

      var labelString = parentMesh.userData.name;

      var textGeo = new THREE.TextGeometry(labelString, {
        font : font,
        size : fontSize,
        height : 0.1,
        curveSegments : 1
      });

      // font color depending on parent object
      let material;
      if (parentMesh.userData.foundation) {
        material = this.get('textMaterialBlack');
      } 
      else if (parentMesh.userData.type === 'package') {
        material = this.get('textMaterialWhite');
      }
      // class
      else {
        material = this.get('textMaterialWhite');
      }

      var mesh = new THREE.Mesh(textGeo, material);



      // calculate textWidth
      textGeo.computeBoundingBox();
      var bboxText = textGeo.boundingBox;
      var textWidth = bboxText.max.x - bboxText.min.x;

      // calculate boundingbox for (centered) positioning
      parentMesh.geometry.computeBoundingBox();
      var bboxParent = parentMesh.geometry.boundingBox;
      var boxWidth = bboxParent.max.x;

      // static size for class text
      if (parentMesh.userData.type === 'class') {
        // static scaling factor
        var j = 0.2;
        textGeo.scale(j, j, j);
      }
      // shrink the text if necessary to fit into the box
      else {
        // upper scaling factor
        var i = 1.0;
        // until text fits into the parent bounding box
        while ((textWidth > boxWidth) && (i > 0.1)) {
          textGeo.scale(i, i, i);
          i -= 0.1;
          // update the BoundingBoxes
          textGeo.computeBoundingBox();
          bboxText = textGeo.boundingBox;
          textWidth = bboxText.max.x - bboxText.min.x;
          parentMesh.geometry.computeBoundingBox();
          bboxParent = parentMesh.geometry.boundingBox;
          boxWidth = bboxParent.max.x;
        }
      }

      // calculate center for postioning
      textGeo.computeBoundingSphere();
      var centerX = textGeo.boundingSphere.center.x;

      // set position and rotation
      if (parentMesh.userData.opened) {
        mesh.position.x = bboxNew.min.x + 2;
        mesh.position.y = bboxNew.max.y;
        mesh.position.z = (worldParent.z - Math.abs(centerX) / 2) - 2;
        mesh.rotation.x = -(Math.PI / 2);
        mesh.rotation.z = -(Math.PI / 2);
      } else {
        // TODO fix 'perfect' centering
        if (parentMesh.userData.type === 'class') {
          mesh.position.x = worldParent.x - Math.abs(centerX) / 2 - 0.25;
          mesh.position.y = bboxNew.max.y;
          mesh.position.z = (worldParent.z - Math
              .abs(centerX) / 2) - 0.25;
          mesh.rotation.x = -(Math.PI / 2);
          mesh.rotation.z = -(Math.PI / 4);
        } else {
          mesh.position.x = worldParent.x - Math.abs(centerX) / 2;
          mesh.position.y = bboxNew.max.y;
          mesh.position.z = worldParent.z - Math.abs(centerX) / 2;
          mesh.rotation.x = -(Math.PI / 2);
          mesh.rotation.z = -(Math.PI / 4);
        }
      }

      // internal user-defined type
      mesh.userData = {
        type : 'label',
        name : parentMesh.userData.name,
        parentPos : worldParent
      };

      // add to scene
      //self.combinedMeshes.push(mesh);
      //mesh.add(mesh);
      mesh.name = 'labelApp3D';
      this.get('labels').push(mesh);
      parentObject.add(mesh);

      //return textMesh;

    }

  },







  //////////////////////////////// Landscape labeling

  textLabels: {},

  systemTextCache: [],
  nodeTextCache: [],
  appTextCache: [],

  font: null,

  saveTextForLabeling(textToShow, parent, color) {

    const emberModelName = parent.userData.model.constructor.modelName;
    const text = textToShow ? textToShow : parent.userData.model.get('name');

    let textCache = 'systemTextCache';

    if(emberModelName === "node"){
      textCache = 'nodeTextCache';
    }
    else if(emberModelName === "application") {
      textCache = 'appTextCache';
    }

    this.get(textCache).push({text: text, parent: parent, color: color});
  },


  drawTextLabels(font, configuration) {

    this.set('font', font);
    this.set('configuration', configuration);

    this.drawSystemTextLabels();
    this.drawNodeTextLabels();
    this.drawAppTextLabels();

    // After drawing, reset all caches for next tick
    this.set('systemTextCache', []);
    this.set('nodeTextCache', []);
    this.set('appTextCache', []);

  },


  drawSystemTextLabels() {

    const self = this;

    this.get('systemTextCache').forEach((textObj) => {

      const threejsModel = textObj.parent;
      const emberModel = threejsModel.userData.model;

      let labelMesh = this.isLabelAlreadyCreated(emberModel);

      if(labelMesh && labelMesh.mesh) {

        //console.log("old label");
        // update meta-info for model
        labelMesh.mesh.userData['model'] = emberModel;
        threejsModel['label'] = labelMesh.mesh;
        threejsModel.add(labelMesh.mesh);
        labelMesh = labelMesh.mesh;

      }
      else {
      	var materials = [
					new THREE.MeshPhongMaterial( { color: 0xffffff, shading: THREE.FlatShading } ), // front
					new THREE.MeshPhongMaterial( { color: 0xffffff, shading: THREE.SmoothShading } ) // side
				];

       // console.log("new label");
        const labelGeo = new THREE.TextBufferGeometry(textObj.text, {
          font: self.get('font'),
          size: 0.4,
          height: 0
        });

        const material = new THREE.MeshBasicMaterial({
          color: textObj.color
        });

        labelMesh = new THREE.Mesh(labelGeo, material);

        labelMesh.userData['type'] = 'label';
        labelMesh.userData['model'] = emberModel;      
      
        self.get('textLabels')[emberModel.get('id')] = 
          {"mesh": labelMesh};

        threejsModel['label'] = labelMesh;
        threejsModel.add(labelMesh);


      }


      this.repositionSystemLabel(labelMesh);


    });
  },


  drawNodeTextLabels() {

    const self = this;

    this.get('nodeTextCache').forEach((textObj) => {

      const threejsModel = textObj.parent;
      const emberModel = threejsModel.userData.model;

      let labelMesh = this.isLabelAlreadyCreated(emberModel);

      const nodegroupstate = emberModel.get('parent.opened');

      if(labelMesh && labelMesh.mesh && 
        labelMesh.nodegroupopenstate === nodegroupstate) {

        //console.log("old label");
        // update meta-info for model
        labelMesh.mesh.userData['model'] = emberModel;  
        threejsModel['label'] = labelMesh.mesh;
        threejsModel.add(labelMesh.mesh);
        labelMesh = labelMesh.mesh;  

      }
      else {

        //console.log("new label");

        const text = emberModel.getDisplayName();
        textObj.text = text;

        const labelGeo = new THREE.TextBufferGeometry(text, {
          font: self.get('font'),
          size: 0.3,
          height: 0
        });

        const material = new THREE.MeshBasicMaterial({
          color: textObj.color
        });

        labelMesh = new THREE.Mesh(labelGeo, material);

        labelMesh.userData['type'] = 'label';
        labelMesh.userData['model'] = emberModel;
        
        self.get('textLabels')[emberModel.get('id')] = 
          {"mesh": labelMesh, "nodegroupopenstate": emberModel.get('parent.opened')};

        threejsModel['label'] = labelMesh;
        threejsModel.add(labelMesh);

      }

      
      this.repositionNodeLabel(labelMesh);


    });
  },



  drawAppTextLabels() {

    const self = this;

    this.get('appTextCache').forEach((textObj) => {

      const threejsModel = textObj.parent;
      const emberModel = threejsModel.userData.model;

      let labelMesh = this.isLabelAlreadyCreated(emberModel);

      if(labelMesh && labelMesh.mesh) {

        //console.log("old label");
        // update meta-info for model
        labelMesh.mesh.userData['model'] = emberModel;  
        threejsModel['label'] = labelMesh.mesh;
        threejsModel.add(labelMesh.mesh);
        labelMesh = labelMesh.mesh;

      }
      else {

        //console.log("new label");

        const labelGeo = new THREE.TextBufferGeometry(textObj.text, {
          font: self.get('font'),
          size: 0.25,
          height: 0
        });

        const material = new THREE.MeshBasicMaterial({
          color: textObj.color
        });

        labelMesh = new THREE.Mesh(labelGeo, material);

        labelMesh.userData['type'] = 'label';
        labelMesh.userData['model'] = emberModel;
        
        self.get('textLabels')[emberModel.get('id')] = 
          {"mesh": labelMesh};

        threejsModel['label'] = labelMesh;
        threejsModel.add(labelMesh);
      }

      
      this.repositionAppLabel(labelMesh);


    });
  },


  repositionSystemLabel(labelMesh) {

    const parent = labelMesh.parent;

    parent.geometry.computeBoundingBox();
    const bboxParent = parent.geometry.boundingBox;

    labelMesh.geometry.computeBoundingBox();
    const labelBoundingBox = labelMesh.geometry.boundingBox;
    
    const labelLength = Math.abs(labelBoundingBox.max.x) - 
      Math.abs(labelBoundingBox.min.x);

    const yOffset = 0.6;

    labelMesh.position.x = - (labelLength / 2.0);
    labelMesh.position.y = bboxParent.max.y -yOffset;

    // Compute y max (rotated 90) for label position
    labelMesh.position.z = parent.geometry.boundingBox.max.z + 0.001;
  },


  repositionNodeLabel(labelMesh) {

    const parent = labelMesh.parent;

    parent.geometry.computeBoundingBox();
    const bboxParent = parent.geometry.boundingBox;

    labelMesh.geometry.computeBoundingBox();
    const labelBoundingBox = labelMesh.geometry.boundingBox;
    
    const labelLength = Math.abs(labelBoundingBox.max.x) - 
      Math.abs(labelBoundingBox.min.x);

    const yOffset = 0.2;

    labelMesh.position.x = - (labelLength / 2.0);
    labelMesh.position.y = bboxParent.min.y + yOffset;
    labelMesh.position.z = parent.position.z + parent.geometry.parameters.depth/2 + 0.001;
    
  },


  repositionAppLabel(labelMesh) {

    const parent = labelMesh.parent;
    
    parent.geometry.computeBoundingBox();
    const bboxParent = parent.geometry.boundingBox;

    labelMesh.geometry.computeBoundingBox();
    const labelBoundingBox = labelMesh.geometry.boundingBox;

    const labelHeight = Math.abs(labelBoundingBox.max.y) - 
      Math.abs(labelBoundingBox.min.y);

    const xOffset = 0.1;

    labelMesh.position.x = bboxParent.min.x + xOffset;
    labelMesh.position.y = -(labelHeight / 2.0);
    labelMesh.position.z = parent.position.z + parent.geometry.parameters.depth/2 + 0.002;
    
  },



  isLabelAlreadyCreated(emberModel) {

    // label already created and color didn't change?
    if(this.get('textLabels')[emberModel.get('id')] && 
      !this.get('configuration.landscapeColors.textchanged')) {

      const oldTextLabelObj = 
        this.get('textLabels')[emberModel.get('id')];

      return oldTextLabelObj;
    }

    return null;

  },


  findLongestTextLabel(labelStrings) {
    let longestString = "";

    labelStrings.map(function(obj){

      if(obj.text.length >= longestString.length) {
        //console.log(obj.text);
        longestString = obj.text;
      }
    });

    return longestString;

  }

});