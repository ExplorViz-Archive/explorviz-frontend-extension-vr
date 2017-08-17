import Ember from 'ember';
import THREE from "npm:three";
//import config from '../config/environment';
import THREEPerformance from '../mixins/threejs-performance';

import Raycaster from '../utils/raycaster';

import applyKlayLayout from '../utils/vr-rendering/klay-layouter';
import Interaction from '../utils/vr-rendering/interaction';
//import InteractionApp from '../utils/application-rendering/interaction';
import Labeler from '../utils/vr-rendering/labeler';
import LabelerApp from '../utils/application-rendering/labeler';
import CalcCenterAndZoom from '../utils/vr-rendering/center-and-zoom-calculator';

import ImageLoader from '../utils/three-image-loader';

import Meshline from "npm:three.meshline";

import ObjectLoader from 'npm:three-obj-loader';
import applyCityLayout from '../utils/application-rendering/city-layouter';

import {
  createFoundation,
  removeFoundation
} from '../utils/application-rendering/foundation-builder';



/**
 * This component contains the core mechanics of the different (three.js-based) 
 * renderer. All functions below are called in a determined order, hence you only 
 * need to override them in your custom renderer.
 *
 * See {{#crossLink "Landscape-Rendering"}}{{/crossLink}} or 
 * {{#crossLink "Application-Rendering"}}{{/crossLink}} for example usage.
 *
 * Call order:
 *
 * 1. 
 *
 * @class Rendering-Core
 * @extends Ember.Component
 */
export default Ember.Component.extend(Ember.Evented, THREEPerformance, {

  state: null,

  store: Ember.inject.service('store'),

  // Declare url-builder service 
  urlBuilder: Ember.inject.service("url-builder"),

  // Declare view-importer service 
  viewImporter: Ember.inject.service("view-importer"),

  reloadHandler: Ember.inject.service("reload-handler"),
  landscapeRepo: Ember.inject.service("repos/landscape-repository"),
  renderingService: Ember.inject.service(),

  classNames: ['viz'],

  scene: null,
  webglrenderer: null,
  camera: null,

  canvas: null,

  app3DExists: true,

  font: null,
  animationFrameId: null,

  initDone: false,

  configuration: Ember.inject.service("configuration"),

  configurationApplication: Ember.inject.service("configuration-application"),

  hammerManager: null,

  raycaster: null,
  interaction: null,
  labeler: null,

  labelerApp: null,
  //interactionApp: null,
  //viewCenterPoint: null,


  imageLoader: null,
  centerAndZoomCalculator: null,

  openSymbol: null,
  closeSymbol: null,

  initialRendering: true,

  // VR
  vrControls: null,
  vrEffect: null,
  table: null,
  vrEnvironment: null,
  vrSystems: null,
  geometry: null,
  line1: null,
  line2: null,
  controller1: null,
  controller2: null,
  loader: null,
  depth: 0.2,
  oldDistanceX: 0,
  oldDistanceY: 0,
  initCentering: true,
  cameraDolly: null,
  vrAvailable: false,


  trash: null,

  // Stores mesh for 3D application
  app3DMesh: null,



  // Application
  application3D: null,

  applicationID: null,



  // @Override
  didRender() {
    this._super(...arguments);
    this.initRendering();
    this.initListener();
  },


  // @Override
  willDestroyElement() {
    this._super(...arguments);
    this.cleanup();
  },

  /**
   * This function is called once on the didRender event. Inherit this function 
   * to call other important function, e.g. initInteraction as shown in 
   * {@landscape-rendering}.
   *
   * @method initRendering
   */
  initRendering() {

    const self = this;

    // Check if WebVR is supported
    WEBVR.checkAvailability().catch(function(reject) {
      self.get('interaction').showAlertifyMessage(reject);
    });

    // dummy object for raycasting
    this.set('table', new THREE.Object3D());
    this.get('table').name = 'table';
    this.set('vrSystems', new THREE.Object3D());
    this.get('vrSystems').name = 'systems';
    this.set('vrEnvironment', new THREE.Object3D());
    this.get('vrEnvironment').name = 'landscape';

    this.set('trash', new THREE.Object3D());
    this.get('trash').name = 'trash';

    // remove stored applications
    this.set('landscapeRepo.latestApplication', null);

    // rotate landscape by 90 degrees (radiant)
    this.get('vrEnvironment').rotateX(-1.5707963);

    // get size if outer ember div
    const height = this.$()[0].clientHeight;
    const width = this.$()[0].clientWidth;

    const canvas = this.$('#threeCanvas')[0];

    this.set('canvas', canvas);

    this.set('scene', new THREE.Scene());
    this.set('scene.background', new THREE.Color(0xffffff));

    this.set('camera', new THREE.PerspectiveCamera(75, width / height, 0.1, 1000));

    // Frame to manipulate camera
    this.set("cameraDolly", new THREE.Group());
    this.get("cameraDolly").position.set(0, 0, 0);
    this.get("cameraDolly").add(this.get("camera"));
    this.get("scene").add(this.get("cameraDolly"));
    this.get('cameraDolly').name = 'dolly';

    this.set('webglrenderer', new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas
    }));
    this.get('webglrenderer').setPixelRatio(window.devicePixelRatio);
    this.get('webglrenderer').setSize(width, height);


    this.set('vrControls', new VRControls(this.get('camera')));
    this.set('vrEffect', new VREffect(this.get('webglrenderer')));

    // Controller
    this.set('controller1', new ViveController(0));
    this.get('controller1').standingMatrix = this.get('vrControls').getStandingMatrix();
    this.get('controller1').name = "controller";
    this.get('scene').add(this.get('controller1'));

    this.set('controller2', new ViveController(1));
    this.get('controller2').standingMatrix = this.get('vrControls').getStandingMatrix();
    this.get('controller2').name = "controller";
    this.get('scene').add(this.get('controller2'));


    // Ray for Controller
    this.set('geometry', new THREE.Geometry());

    this.get('geometry').vertices.push(new THREE.Vector3(0, 0, 0));
    this.get('geometry').vertices.push(new THREE.Vector3(0, 0, -1));

    this.set('line', new THREE.Line(this.get('geometry')));
    this.get('line').name = 'controllerLine';
    this.get('line').scale.z = 5;

    this.get('controller1').add(this.get('line').clone());
    this.get('controller2').add(this.get('line').clone());

    this.get('scene').add(this.get('vrEnvironment'));

    // Loader for VIVE-Controller texture
    new ObjectLoader(THREE);
    var loader = new THREE.OBJLoader();
    loader.setPath('vive-controller/');
    loader.load('vr_controller_vive_1_5.obj', function(object) {
      const obj = object;
      obj.name = "viveTexture";
      var loader = new THREE.TextureLoader();
      loader.setPath('vive-controller/');
      var controller = obj.children[0];
      controller.material.map = loader.load('onepointfive_texture.png');
      controller.material.specularMap = loader.load('onepointfive_spec.png');
      self.get('controller1').add(obj.clone());
      self.get('controller2').add(obj.clone());
    });

    // VR Rendering loop //
    function render() {
      //console.log("vr rendering");
      const animationId = requestAnimationFrame(render);
      self.set('animationFrameId', animationId);
      self.get('vrControls').update();
      self.get('controller1').update();
      self.get('controller2').update();

      // Check raycast for intersection
      if (self.get('interaction')) {
        // only if no application3D binded to controller
        if(!self.get('interaction').get('app3DBinded')){
          self.get('interaction').checkIntersection(self.get('controller1'));
          self.get('interaction').checkIntersection(self.get('controller2'));
        }
      }

      self.get('vrEffect').render(self.get('scene'), self.get('camera'));
    }
    render();

    // Activate and set userhight
    this.get('vrControls').standing = true;
    this.get('vrControls').userHight = 1.68;

    ////////////////////

    // load font for labels and synchronously proceed with populating the scene
    new THREE.FontLoader()
      .load('three.js/fonts/roboto_mono_bold_typeface.json', function(font) {
        self.set('font', font);
        self.set('initDone', true);
        self.populateScene();
      });

    this.debug("init vr-rendering");

    this.onReSetupScene = function() {
      this.set('centerAndZoomCalculator.centerPoint', null);
      this.get('camera.position').set(0, 0, 0);
      this.cleanAndUpdateScene();
    };

    this.onUpdated = function() {
      if (this.get('initDone')) {
        //this.preProcessEntity();
        this.cleanAndUpdateScene();
      }
    };

    this.onResized = function() {
      this.set('centerAndZoomCalculator.centerPoint', null);
      this.cleanAndUpdateScene();
    };

    if (!this.get('interaction')) {
      this.set('interaction', Interaction.create());
    }

    if (!this.get('imageLoader')) {
      this.set('imageLoader', ImageLoader.create());
    }

    if (!this.get('labeler')) {
      this.set('labeler', Labeler.create());
    }

    if (!this.get('labelerApp')) {
      this.set('labelerApp', LabelerApp.create());
    }

    if (!this.get('raycaster')) {
      this.set('raycaster', Raycaster.create());
    }

    if (!this.get('centerAndZoomCalculator')) {
      this.set('centerAndZoomCalculator', CalcCenterAndZoom.create());
    }

    this.initInteraction();

    const dirLight = new THREE.DirectionalLight();
    dirLight.position.set(30, 10, 20);
    this.get('scene').add(dirLight);

    const spotLight = new THREE.SpotLight(0xffffff, 0.5, 1000, 1.56, 0, 0);
    spotLight.position.set(0, 0, 0);
    spotLight.castShadow = false;
    this.get('scene').add(spotLight);

    const light = new THREE.AmbientLight(
      // AmbientLight( color, intensity )
      new THREE.Color(0.65, 0.65, 0.65), 0.8);
    this.scene.add(light);

    // set default model
    this.set('imageLoader.logos', {});
    this.set('labeler.textLabels', {});
    this.set('labeler.systemTextCache', []);
    this.set('labeler.nodeTextCache', []);
    this.set('labeler.appTextCache', []);

    this.set('centerAndZoomCalculator.centerPoint', null);


    // create table
    var texture = new THREE.TextureLoader().load('images/materials/holz.jpg');
    var tabletopGeometry = new THREE.BoxGeometry(3, 0.2, 1.5);
    // Big
    //var tabletopGeometry = new THREE.BoxGeometry(30,0.2,10);

    var material = new THREE.MeshBasicMaterial({
      map: texture
    });

    var tabletop = new THREE.Mesh(tabletopGeometry, material);
    tabletop.position.set(0, -3, 0);
    tabletop.name = "tableTop";

    var tableLegGeometry = new THREE.BoxBufferGeometry(0.01, 1, 0.01);
    // var tableLegGeometry = new THREE.BoxBufferGeometry(1,10,1);

    var tableLeg1 = new THREE.Mesh(tableLegGeometry, material);
    tableLeg1.position.set(1.5, -3.4, 0.75);
    //tableLeg1.position.set(12,-8, 3);
    tableLeg1.name = "tableLeg1";

    var tableLeg2 = new THREE.Mesh(tableLegGeometry, material);
    tableLeg2.position.set(1.5, -3.4, -0.75);
    //tableLeg2.position.set(12,-8,-3);     
    tableLeg2.name = "tableLeg2";

    var tableLeg3 = new THREE.Mesh(tableLegGeometry, material);
    tableLeg3.position.set(-1.5, -3.4, -0.75);
    //tableLeg3.position.set(-12,-8, -3);
    tableLeg3.name = "tableLeg3";

    var tableLeg4 = new THREE.Mesh(tableLegGeometry, material);
    tableLeg4.position.set(-1.5, -3.4, 0.75);
    //tableLeg4.position.set(-12,-8, 3);      
    tableLeg4.name = "tableLeg4";

    self.get('table').add(tabletop);
    self.get('table').add(tableLeg1);
    self.get('table').add(tableLeg2);
    self.get('table').add(tableLeg3);
    self.get('table').add(tableLeg4);
    self.get('table').position.y = 3;
    self.get('scene').add(self.get('table'));

    // Create trashbin
    var trashGeometry = new THREE.CylinderBufferGeometry(tableLeg4.geometry.parameters.height / 2, tableLeg4.geometry.parameters.height / 2, tableLeg4.geometry.parameters.height * 1.2, 32);
    var trashMaterial = new THREE.MeshBasicMaterial({
      color: 0x2E2E2E
    });
    var trashCylinder = new THREE.Mesh(trashGeometry, trashMaterial);
    trashCylinder.name = 'trash';
    self.get('trash').add(trashCylinder);
    self.get('scene').add(self.get('trash'));

    // position trash next to table
    self.get('trash').position.x = tabletop.position.x + tabletop.geometry.parameters.width * 2;
    self.get('trash').position.y = tableLeg4.position.y + tableLeg4.geometry.parameters.height / 2;
    self.get('trash').position.z = tabletop.position.z;

    // VR-Button
    WEBVR.getVRDisplay(function(display) {
      self.set('vrAvailable', true);
      document.body.appendChild(WEBVR.getButton(display, self.get('webglrenderer').domElement));
    });
  },


  initListener() {

    const self = this;

    this.$(window).on('resize.visualization', function() {
      const outerDiv = this.$('.viz')[0];

      if (outerDiv) {

        const height = Math.round(this.$('.viz').height());
        const width = Math.round(this.$('.viz').width());

        self.set('camera.aspect', width / height);
        self.get('camera').updateProjectionMatrix();

        self.get('webglrenderer').setSize(width, height);

        self.onResized();
      }
    });


    this.get('viewImporter').on('transmitView', function(newState) {
      self.set('newState', newState);
    });


    this.get('renderingService').on('reSetupScene', function() {
      self.onReSetupScene();
    });


    this.get('urlBuilder').on('requestURL', function() {
      const state = {};

      // get timestamp
      state.timestamp = self.get('landscapeRepo.latestLandscape')
        .get('timestamp');

      // get latestApp, may be null
      const latestMaybeApp = self.get('landscapeRepo.latestApplication');
      state.appID = latestMaybeApp ? latestMaybeApp.get('id') : null;

      state.camX = self.get('camera').position.x;
      state.camY = self.get('camera').position.y;
      state.camZ = self.get('camera').position.z;

      // Passes the state from component via service to controller
      self.get('urlBuilder').transmitState(state);
    });


    this.get('landscapeRepo').on("updated", function() {
      self.onUpdated();
    });
  },


  /**
    This method is used to update the camera with query parameters
  */
  importView() {

    this.get('viewImporter').requestView();

    const camX = this.get('newState').camX;
    const camY = this.get('newState').camY;
    const camZ = this.get('newState').camZ;

    if (!isNaN(camX)) {
      this.get('camera').position.x = camX;
    }
    if (!isNaN(camY)) {
      this.get('camera').position.y = camY;
    }
    if (!isNaN(camZ)) {
      this.get('camera').position.z = camZ;
    }
    this.get('camera').updateProjectionMatrix();

    // load actual landscape    
    const timestamp = this.get('newState').timestamp;
    const appID = this.get('newState').appID;

    if (timestamp) {
      this.get('reloadHandler').stopExchange();
      this.get('landscapeRepo').loadLandscapeById(timestamp, appID);
    }
  },


  /**
   * This function is called when the willDestroyElement event is fired. Inherit this 
   * function to cleanup custom properties or unbind listener 
   * as shown in {{#crossLink "Landscape-Rendering"}}{{/crossLink}}.
   *
   * @method cleanup
   */
  cleanup() {
    cancelAnimationFrame(this.get('animationFrameId'));

    this.set('scene', null);
    this.set('webglrenderer', null);
    this.set('camera', null);
    this.get('urlBuilder').off('requestURL');

    this.removePerformanceMeasurement();

    this.$(window).off('resize.visualization');
    this.get('viewImporter').off('transmitView');
    this.get('renderingService').off('reSetupScene');
    this.get('landscapeRepo').off('updated');

    this.debug("cleanup landscape rendering");

    this.set('imageLoader.logos', {});
    this.set('labeler.textLabels', {});
    this.set('labeler.textCache', []);

    this.get('interaction').off('redrawScene');
    this.get('interaction').off('redrawVREnvironment');
    this.get('interaction').off('redrawApp');
    this.get('interaction').off('checkIntersection');
    this.get('interaction').off('showApplication');

    this.get('interaction').removeHandlers();

    const emberLandscape = this.get('landscapeRepo.latestLandscape');

    // Open all systems for 2D visualization
    if (emberLandscape) {
      emberLandscape.get('systems').forEach(function(system) {
        system.setOpened(true);
      });
      this.set('initialRendering', true);
    }

    if (this.get('landscapeRepo.latestApplication')) {
      // remove foundation for re-rendering
      const emberApplication = this.get('application3D.userData.model');
      removeFoundation(emberApplication, this.get('store'));
      this.set('landscapeRepo.latestApplication', null);
    }

    this.set('applicationID', null);
    this.set('application3D', null);

    var gl = this.get('canvas').getContext('webgl');
    gl.getExtension('WEBGL_lose_context').loseContext();

    // Remove VR-Button from DOM 
    if (this.get('vrAvailable')) {
      document.body.removeChild(document.body.lastChild);
    }
  },


  /**
   * Inherit this function to update the scene with a new renderingModel. It 
   * automatically removes every mesh from the scene. Add your custom code 
   * as shown in landscape-rendering.
   *
   * @method cleanAndUpdateScene
   */
  cleanAndUpdateScene() {

    this.debug("clean and populate landscape rendering");

    this.populateScene();

    this.set('interaction.raycastObjects', this.get('scene.children'));
  },


  /**
   * This function is called automatically when a new landscape was fetched. It 
   * is executed before 
   * {{#crossLink "Rendering-Core/cleanAndUpdateScene:method"}}{{/crossLink}}.
   * Inherit this function to preprocess the 
   * {{#crossLink "Landscape"}}{{/crossLink}} for rendering, e.g. filter some 
   * value.
   *
   * See {{#crossLink "Application-Rendering"}}{{/crossLink}} for example usage.
   *
   * @method preProcessEntity
   */
  // @Override
  preProcessEntity() {
    /*const application = this.get('store').peekRecord('application', 
      this.get('applicationID'));
    this.set('landscapeRepo.latestApplication', application);*/
  },



  // @Override
  populateScene() {
    this._super(...arguments);
    const self = this;
    const meshes = [];

    const emberLandscape = this.get('landscapeRepo.latestLandscape');

    if (!emberLandscape || !this.get('font')) {
      return;
    }

    /* Close all systems and set new depth value for systems, 
     nodegroups, nodes and applications */
    if (emberLandscape) {

      if (this.get('initialRendering')) {
        emberLandscape.get('systems').forEach(function(system) {
          system.setOpened(false);
          system.set('depth', self.get('depth'));

          const nodegroups = system.get('nodegroups');
          nodegroups.forEach(function(nodegroup) {
            //nodegroup.setOpened(true);
            nodegroup.set('depth', self.get('depth'));

            const nodes = nodegroup.get('nodes');
            nodes.forEach(function(node) {
              node.set('depth', self.get('depth'));

              /*const applications = node.get('applications');
                applications.forEach(function(application) {
                application.set('depth', self.get('depth'));
              });*/
            });
          });
        });
        this.set('initialRendering', false);
      }
    }

    applyKlayLayout(emberLandscape);

    this.set('vrEnvironment.userData.model', emberLandscape);

    const systems = emberLandscape.get('systems');

    const scaleFactor = {
      width: 0.5,
      height: 0.5
    };

    let isRequestObject = false;

    // create plus or minus, if not already done
    if (!(this.get('openSymbol') && this.get('closeSymbol')) &&
      this.get('font')) {
      createCollapseSymbols();
    }

    if (systems) {
      // calculate new center and update zoom
      if (!this.get('centerAndZoomCalculator.centerPoint')) {

        this.get('centerAndZoomCalculator')
          .calculateLandscapeCenterAndZZoom(emberLandscape,
            this.get('webglrenderer'));

        // Exclude import view for vr
        /*if(!this.get('viewImporter.importedURL')) {
          const cameraZ = this.get('centerAndZoomCalculator.cameraZ');
          this.set('camera.position.z', cameraZ);
          this.get('camera').updateProjectionMatrix();      
        }*/

      }


      var centerPoint = this.get('centerAndZoomCalculator.centerPoint');

      systems.forEach(function(system) {

        isRequestObject = false;

        var extensionX, extensionY, centerX, centerYClosed, centerYOpened;

        if (!isRequestObject && system.get('name') === "Requests") {
          isRequestObject = true;

          // add earth
          extensionX = system.get('width') * scaleFactor.width;
          extensionY = system.get('height') * scaleFactor.height;

          centerX = system.get('positionX') + extensionX - centerPoint.x;
          centerYClosed = system.get('positionY') - extensionY - centerPoint.y;
          centerYOpened = system.get('positionY') - extensionY - centerPoint.y;

          // Create mesh for earth
          var requesteometry = new THREE.SphereGeometry(0.1, 32, 32);
          console.log("before loader");
          var texture = new THREE.TextureLoader().load('images/logos/requests.png');
          console.log("after loader");
          var material = new THREE.MeshPhongMaterial({
            map: texture
          });

          var requests = new THREE.Mesh(requesteometry, material);

          requests.position.set(centerX, centerYClosed, system.get('positionZ'));

          meshes.push(requests);
        }


        if (!isRequestObject) {

          extensionX = system.get('width') * scaleFactor.width;
          extensionY = system.get('height') * scaleFactor.height;

          centerX = system.get('positionX') + extensionX - centerPoint.x;
          centerYClosed = system.get('positionY') - extensionY - centerPoint.y;
          centerYOpened = system.get('positionY') - extensionY - centerPoint.y;


          // Draw box for closed and plane for opened systems
          var systemMesh;
          if (system.get('opened')) {
            systemMesh = createPlane(system);
            systemMesh.name = 'systemOpened';
            // Transform z-position of closed system to opened system 
            systemMesh.position.set(centerX, centerYOpened, system.get('positionZ') - system.get('depth') / 2);
          } else {
            systemMesh = createBox(system);
            systemMesh.name = 'systemClosed';
            systemMesh.position.set(centerX, centerYClosed, system.get('positionZ'));
          }
          systemMesh.type = 'system';


          meshes.push(systemMesh);
          system.set('threeJSModel', systemMesh);

          const textColor =
            self.get('configuration.landscapeColors.textsystem');

          self.get('labeler').saveTextForLabeling(null, systemMesh, textColor);


        }



        const nodegroups = system.get('nodegroups');
        nodegroups.forEach(function(nodegroup) {

          let nodegroupMesh;

          if (!nodegroup.get('visible')) {
            return;
          }

          if (!isRequestObject) {

            //onsole.log("position node");
            //console.log(centerX);
            //console.log(nodegroup.get('positionX'));

            extensionX = nodegroup.get('width') * scaleFactor.width;
            extensionY = nodegroup.get('height') * scaleFactor.height;

            centerX = nodegroup.get('positionX') + extensionX - centerPoint.x;
            centerYOpened = nodegroup.get('positionY') - extensionY - centerPoint.y;
            centerYClosed = nodegroup.get('positionY') - extensionY - centerPoint.y;

            nodegroupMesh = createBox(nodegroup);
            nodegroupMesh.type = 'nodegroup';
            nodegroupMesh.name = 'nodegroup';
            nodegroupMesh.position.set(centerX, centerYOpened,
              nodegroup.get('positionZ') + 0.001);


            //console.log("position node centerX");
            //console.log(centerX);

            // add respective open / close symbol
            nodegroupMesh.geometry.computeBoundingBox();
            const bboxNodegroup = nodegroupMesh.geometry.boundingBox;

            let collapseSymbol = null;

            if (nodegroup.get('opened')) {
              if (self.get('closeSymbol')) {
                collapseSymbol = self.get('closeSymbol').clone();
              }
            } else {
              if (self.get('openSymbol')) {
                collapseSymbol = self.get('openSymbol').clone();
              }
            }

            if (collapseSymbol) {
              collapseSymbol.position.x = bboxNodegroup.max.x - 0.35;
              collapseSymbol.position.y = bboxNodegroup.max.y - 0.35;

              // new z for 3D
              collapseSymbol.position.z = nodegroupMesh.position.z + nodegroupMesh.geometry.parameters.depth / 2;
              meshes.push(collapseSymbol);
            }


          }

          const nodes = nodegroup.get('nodes');

          // Draw nodes only if nodegroup is opened
          if (nodegroup.get('opened')) {

            nodes.forEach(function(node) {
              if (!node.get('visible')) {
                return;
              }
              if (nodes.content.length > 1) {
                meshes.push(nodegroupMesh);
                nodegroup.set('threeJSModel', nodegroupMesh);
              }
              let nodeMesh;
              extensionX = node.get('width') * scaleFactor.width;
              extensionY = node.get('height') * scaleFactor.height;

              centerX = node.get('positionX') + extensionX - centerPoint.x;
              centerYOpened = node.get('positionY') - extensionY - centerPoint.y;

              // Draw Box for node 
              nodeMesh = createBox(node);
              nodeMesh.type = "application";
              nodeMesh.position.set(centerX, centerYOpened, node.get('positionZ') + 0.002);

              meshes.push(nodeMesh);
              node.set('threeJSModel', nodeMesh);
              // Draw Box for Node
              const applications = node.get('applications');

              applications.forEach(function(application) {

                if (!isRequestObject) {

                  // Draw application in landscape-view 
                  if (!isRequestObject) {

                    let applicationMesh = createBox(application);

                    applicationMesh.type = 'application';

                    applicationMesh.position.set(centerX, centerYOpened,
                      application.get('positionZ') + nodeMesh.geometry.parameters.depth / 2 + 0.003);

                    meshes.push(applicationMesh);
                    application.set('threeJSModel', applicationMesh);

                    // create logos 

                    applicationMesh.geometry.computeBoundingBox();

                    const logoSize = {
                      width: 0.4,
                      height: 0.4
                    };
                    const appBBox = applicationMesh.geometry.boundingBox;

                    const logoPos = {
                      x: 0,
                      y: 0,
                      z: 0
                    };

                    const logoRightPadding = logoSize.width * 0.7;

                    logoPos.x = appBBox.max.x - logoRightPadding;

                    const texturePartialPath = application.get('database') ?
                      'database2' : application.get('programmingLanguage')
                      .toLowerCase();

                    self.get('imageLoader').createPicture(logoPos.x, logoPos.y,
                      logoPos.z + 0.001, logoSize.width, logoSize.height,
                      texturePartialPath, applicationMesh, "label");

                    // create text labels

                    let textColor =
                      self.get('configuration.landscapeColors.textapp');

                    self.get('labeler').saveTextForLabeling(null, applicationMesh,
                      textColor);

                    textColor = self.get('configuration.landscapeColors.textnode');
                    self.get('labeler').saveTextForLabeling(node.getDisplayName(),
                      nodeMesh, textColor);

                  }
                }
              });
            });
          }
          // Add box for nodegroup if nodegroup is closed
          // Add box for nodegroup if it contains more than one nodegroup
          else {
            meshes.push(nodegroupMesh);
            nodegroup.set('threeJSModel', nodegroupMesh);
          }
        });
      });
    } // END if(systems)


    self.set('configuration.landscapeColors.textchanged', false);

    const appCommunication = emberLandscape.get('applicationCommunication');

    const tiles = [];

    let tile;

    if (appCommunication) {

      const color = self.get('configuration.landscapeColors.communication');

      appCommunication.forEach((communication) => {

        const points = communication.get('points');

        if (points.length > 0) {

          for (var i = 1; i < points.length; i++) {

            const lastPoint = points[i - 1];
            const thisPoint = points[i];

            let tileWay = {
              startPoint: lastPoint,
              endPoint: thisPoint
            };

            let id = tiles.findIndex(isSameTile, tileWay);


            if (id !== -1) {
              tile = tiles[id];
            } else {
              id = tiles.length; // Gets a new index

              tile = {
                startPoint: lastPoint,
                endPoint: thisPoint,
                positionZ: 0.0025,
                requestsCache: 0,
                communications: [],
                pipeColor: new THREE.Color(color)
              };

              tiles.push(tile);
            }

            tile.communications.push(appCommunication);
            tile.requestsCache = tile.requestsCache +
              communication.get('requests');

            tiles[id] = tile;
          }

        }

      });

      // TODO: Bug: communication lines for closed nodegroups
      //addCommunicationLineDrawing(tiles, meshes);
    }

    //The landscape will be deleted an rewritten


    removeAllChildren(this.get('vrEnvironment'));

    meshes.forEach(function(mesh) {
      this.get('vrEnvironment').add(mesh);
    }.bind(this));

    // Scale landscape to fit on the table
    scaleVREnvironment(this.get('vrEnvironment'));
    // Center landscape on the table to
    centerVREnvironment(this.get('vrEnvironment'));

    // Add landscape to scene
    //this.get('scene').add(this.get('vrEnvironment'));

    // Helper functions //

    function removeAllChildren(entity) {
      for (let i = entity.children.length - 1; i >= 0; i--) {
        let child = entity.children[i];


        removeAllChildren(child);
        const arrayType = ['AmbientLight', 'SpotLight', 'DirectionalLight', 'PerspectiveCamera'];
        const arrayName = ['app3DFoundation', 'table', 'tableTop', 'controller', 'controllerLine', 'viveTexture', 'vr_controller_vive_1_5_polySurface1', 'app3D', 'labelApp3D', 'trash', 'tableLeg1', 'tableLeg2', 'tableLeg3', 'tableLeg4', 'label2D', 'dolly'];
        if (!arrayType.includes(child.type) && !arrayName.includes(child.name)) {
          if (child.type !== 'Object3D') {
            child.geometry.dispose();
            child.material.dispose();
          }

          entity.remove(child);
        }
      }
    }
    /* 
      This method is used to center the landscape on the table.
      The object3D which contains the landscape is centered relative to the table.
    */
    function centerVREnvironment(vrEnvironment) {

      // Compute bounding box of the table
      const bboxTable = new THREE.Box3().setFromObject(self.get('table'));

      // Calculate center of the table 
      const centerTable = bboxTable.getCenter();

      // Compute bounding box of the vrEnvironment
      const bboxLandscape = new THREE.Box3().setFromObject(vrEnvironment);

      // Calculate center of the landscape (vrEnvironment) 
      const centerLandscape = bboxLandscape.getCenter();

      // Calculate offsets
      const offsetX = centerTable.x - centerLandscape.x;
      const offsetZ = centerTable.z - centerLandscape.z;

      // set new position of vrEnvironment
      vrEnvironment.position.x += offsetX;
      vrEnvironment.position.y = bboxTable.max.y + (bboxLandscape.max.y - bboxLandscape.min.y) / 2 + 0.01;
      vrEnvironment.position.z += offsetZ;
    }

    /* 
      This method is used to resize the landscape to fit on the table.
    */
    function scaleVREnvironment(vrEnvironment) {

      // Compute bounding box for table
      const bboxTable = new THREE.Box3().setFromObject(self.get('table'));

      // Get width, height and depth of table
      const sizeTable = bboxTable.getSize();

      // Compute bounding box of the vrEnvironment
      const bboxLandscape = new THREE.Box3().setFromObject(vrEnvironment);

      // Get width, height and depth of the landscape (vrEnvironment) 
      const sizeLandscape = bboxLandscape.getSize();

      const scaleX = sizeTable.x / sizeLandscape.x * vrEnvironment.scale.x;
      const scaleY = sizeTable.z / sizeLandscape.z * vrEnvironment.scale.y;

      /*
        Scale landscape width little distance to the borders of the table (0.01)
        Use scale y because landscape is rotated by 90 degrees
      */
      vrEnvironment.scale.x = scaleX * 0.9;
      vrEnvironment.scale.y = scaleY * 0.9;
    }



    function createCollapseSymbols() {

      const material = new THREE.MeshBasicMaterial({
        color: self.get('configuration.landscapeColors.collapseSymbol')
      });


      // plus symbol

      const labelGeoOpen = new THREE.TextBufferGeometry("+", {
        font: self.get('font'),
        size: 0.35,
        height: 0
      });

      const labelMeshOpen = new THREE.Mesh(labelGeoOpen, material);
      self.set('openSymbol', labelMeshOpen);

      // minus symbol

      const labelGeoClose = new THREE.TextBufferGeometry("-", {
        font: self.get('font'),
        size: 0.35,
        height: 0
      });

      const labelMeshClose = new THREE.Mesh(labelGeoClose, material);
      self.set('closeSymbol', labelMeshClose);
    }

    // This function is only neccessary to find the right index
    function isSameTile(tile) {
      return checkEqualityOfPoints(this.endPoint, tile.endPoint) &&
        checkEqualityOfPoints(this.startPoint, tile.startPoint);
    }

    function isNextTile(newTile) {
      return checkEqualityOfPoints(newTile.startPoint, this.endPoint);
    }

    function addCommunicationLineDrawing(tiles, meshes) {

      const requestsList = {};

      tiles.forEach((tile) => {
        requestsList[tile.requestsCache] = 0;
      });

      const categories = getCategories(requestsList, true);

      for (let i = 0; i < tiles.length; i++) {
        let tile = tiles[i];
        tile.lineThickness = 0.07 * categories[tile.requestsCache] + 0.1;
      }

      for (let i = 0; i < tiles.length; i++) {
        let tile = tiles[i];
        createLine(tile, tiles, meshes);
      }


      function getCategories(list, linear) {

        if (linear) {
          useLinear(list);
        } else {
          useThreshholds(list);
        }

        return list;

        // inner helper functions

        function useThreshholds(list) {
          let max = 1;

          for (let request in list) {
            request = parseInt(request);
            max = (request > max) ? request : max;
          }

          const oneStep = max / 3.0;

          const t1 = oneStep;
          const t2 = oneStep * 2;

          for (let request in list) {
            let categoryValue = getCategoryFromValues(request, t1, t2);
            list[request] = categoryValue;
          }

        }


        function getCategoryFromValues(value, t1, t2) {
          value = parseInt(value);
          if (value === 0) {
            return 0.0;
          } else if (value === 1) {
            return 1.0;
          }

          if (value <= t1) {
            return 2.0;
          } else if (value <= t2) {
            return 3.0;
          } else {
            return 4.0;
          }
        }


        function useLinear(list) {
          let max = 1;
          let secondMax = 1;

          for (let request in list) {
            request = parseInt(request);
            secondMax = (request > max) ? max : secondMax;
            max = (request > max) ? request : max;
          }
          const oneStep = secondMax / 4.0;
          const t1 = oneStep;
          const t2 = oneStep * 2;
          const t3 = oneStep * 3;

          for (let requests in list) {
            let categoryValue = getCategoryFromLinearValues(requests, t1, t2,
              t3);

            list[requests] = categoryValue;
          }

        }


        function getCategoryFromLinearValues(value, t1, t2, t3) {
          value = parseInt(value);
          if (value <= 0) {
            return 0;
          } else if (value <= t1) {
            return 1.5;
          } else if (value <= t2) {
            return 2.5;
          } else if (value <= t3) {
            return 4.0;
          } else {
            return 6.5;
          }
        }



      } // END getCategories

    } // END addCommunicationLineDrawing


    function checkEqualityOfPoints(p1, p2) {
      let x = Math.abs(p1.x - p2.x) <= 0.01;
      let y = Math.abs(p1.y - p2.y) <= 0.01;

      return (x && y);
    }


    function createLine(tile, tiles, meshes) {
      const resolution =
        new THREE.Vector2($("#threeCanvas")[0].width, $("#threeCanvas")[0].height);

      const material = new Meshline.MeshLineMaterial({
        color: tile.pipeColor,
        lineWidth: 0.07 * tile.lineThickness,
        sizeAttenuation: 1,
        resolution: resolution
      });

      const geometry = new THREE.Geometry();

      geometry.vertices.push(
        new THREE.Vector3(tile.startPoint.x - centerPoint.x,
          tile.startPoint.y - centerPoint.y, tile.positionZ)
      );

      geometry.vertices.push(
        new THREE.Vector3(tile.endPoint.x - centerPoint.x,
          tile.endPoint.y - centerPoint.y, tile.positionZ)
      );

      const followingTiles = tiles.filter(isNextTile, tile);
      const length = followingTiles.length;


      for (let i = 0; i < length; i++) {
        let followingTile = followingTiles[i];
        //createGoodEdges(tile, followingTile,  meshes);
      }

      const line = new Meshline.MeshLine();
      line.setGeometry(geometry);

      var lineMesh = new THREE.Mesh(line.geometry, material);

      meshes.push(lineMesh);


      //----------Helper functions
      function createGoodEdges(firstTile, secondTile, meshes) {

        const resolution = new THREE.Vector2($("#threeCanvas")[0].width,
          $("#threeCanvas")[0].height);

        let lineThickness =
          (firstTile.lineThickness < secondTile.lineThickness) ?
          firstTile.lineThickness : secondTile.lineThickness;

        const material = new Meshline.MeshLineMaterial({
          color: secondTile.pipeColor,
          lineWidth: lineThickness * 0.07,
          sizeAttenuation: 1,
          resolution: resolution
        });

        let geometry = new THREE.Geometry();

        geometry.vertices.push(
          new THREE.Vector3(firstTile.startPoint.x - centerPoint.x,
            firstTile.startPoint.y - centerPoint.y, firstTile.positionZ)
        );

        geometry.vertices.push(
          new THREE.Vector3(firstTile.endPoint.x - centerPoint.x,
            firstTile.endPoint.y - centerPoint.y, firstTile.positionZ)
        );

        geometry.vertices.push(
          new THREE.Vector3(secondTile.endPoint.x - centerPoint.x,
            secondTile.endPoint.y - centerPoint.y, secondTile.positionZ)
        );


        const line = new Meshline.MeshLine();
        line.setGeometry(geometry);

        var lineMesh = new THREE.Mesh(line.geometry, material);

        meshes.push(lineMesh);

      }

    } // END createLine

    // Create 3D plane for opened components
    function createPlane(model) {

      const emberModelName = model.constructor.modelName;

      var color = self.get('configuration.landscapeColors.' + emberModelName);

      const material = new THREE.MeshBasicMaterial({
        color
      });

      const plane = new THREE.Mesh(new THREE.BoxGeometry(model.get('width'),
        model.get('height'), 0), material);

      plane.userData['model'] = model;
      return plane;

    }


    // create box for closed landscape-components
    function createBox(model) {

      const emberModelName = model.constructor.modelName;

      var color = self.get('configuration.landscapeColors.' + emberModelName);

      const material = new THREE.MeshBasicMaterial({
        color
      });

      const box = new THREE.Mesh(new THREE.BoxGeometry(model.get('width'),
        model.get('height'), model.get('depth')), material);

      box.userData['model'] = model;
      return box;

    }


    this.get('labeler').drawTextLabels(self.get('font'),
      self.get('configuration'));

  },
  //////////// END populateScene


  initInteraction() {

    const self = this;

    const scene = this.get('scene');
    const canvas = this.get('canvas');
    const raycastObjects = this.get('scene').children;
    const camera = this.get('camera');
    const webglrenderer = this.get('webglrenderer');
    const raycaster = this.get('raycaster');
    const controller1 = this.get('controller1');
    const controller2 = this.get('controller2');
    const parentObjects = this.get('application3D');
    const vrEnvironment = this.get('vrEnvironment');

    // init interaction objects

    this.get('interaction').setupInteraction(scene, canvas, camera, webglrenderer,
      raycaster, raycastObjects, controller1, controller2, parentObjects, vrEnvironment, this.get('configuration.landscapeColors'), this.get('configurationApplication.applicationColors'));

    // set listeners
    this.get('interaction').on('redrawScene', function() {
      self.cleanAndUpdateScene();
    });

    this.get('interaction').on('checkIntersection', function() {
      self.calculateDistanceToTrash();
    });


    this.get('interaction').on('redrawVREnvironment', function() {
      //self.get('vrEnvironment').add(requests);

    });

    // redraw only application3D 
    this.get('interaction').on('redrawApp', function() {
      var appPosition = self.get('app3DMesh').position;
      var appRotation = self.get('app3DMesh').rotation;
      // empty application 3D (remove app3d)
      let app3DModel = self.get('application3D.userData.model');
      self.removeApp3D();
      self.set('landscapeRepo.latestApplication', null);
      // add app3d
      self.add3DApplicationToLandscape(app3DModel, appPosition, appRotation);
      //self.cleanAndUpdateScene();

    }); ///// End redraw application3D 


    // Handle double click on application (plane on node)
    this.get('interaction').on('showApplication', function(emberModel, direction) {
      self.set('viewImporter.importedURL', null);


      if (self.get('landscapeRepo.latestApplication')) {
        // Add 3D Application to scene if it doesnt exist
        if (self.get('landscapeRepo.latestApplication').get('id') !== emberModel.get('id')) {
          self.set('landscapeRepo.latestApplication', emberModel);
          self.add3DApplicationToLandscape(emberModel, direction, new THREE.Vector3(0,0,0));
        }
      } else {
        self.set('landscapeRepo.latestApplication', emberModel);
        self.add3DApplicationToLandscape(emberModel, direction, new THREE.Vector3(0,0,0));
      }
    });

  }, // END initInteraction

  /*
    This method is used to calculate the intersection box of the 3D application and the
    trash bin. The application will be removed if the intersection box is big enough, which
    means that the application is deep enough in the trash bin

  */
  calculateDistanceToTrash() {

    var bboxTrash = new THREE.Box3().setFromObject(this.get('trash'));

    var bboxApp = new THREE.Box3().setFromObject(this.get('application3D'));

    var intersectionVector = bboxApp.intersect(bboxTrash);

    // No intersection if vectors is infinite
    if (isFinite(intersectionVector.max.x)) {

      /* The intersection box should have a minimum width, height and depth so that the application
          is not removed by the first intersection
      */
      if (Math.abs(Math.abs(intersectionVector.max.x) - Math.abs(intersectionVector.min.x)) > 0.4 && Math.abs(Math.abs(intersectionVector.max.y) - Math.abs(intersectionVector.min.y)) > 0.1 && Math.abs(Math.abs(intersectionVector.max.z) - Math.abs(intersectionVector.min.z)) > 0.1) {
        this.removeApp3D();
        this.set('landscapeRepo.latestApplication', null);
        this.set("app3DExists", false);
      }
    }
  },


  /*
    This method is used to remove a 3D application from the scene
  */
  removeApp3D() {

    const scene = this.get('scene');

    removeApp3D(scene);

    function removeApp3D(entity) {
      for (let i = entity.children.length - 1; i >= 0; i--) {
        let child = entity.children[i];

        removeApp3D(child);
        if (child.name === 'app3D' || child.name === 'labelApp3D') {
          if (child.type !== 'Object3D') {
            child.geometry.dispose();
            child.material.dispose();
          }
          entity.remove(child);
        }
      }
    }
    // remove foundation for re-rendering
    const emberApplication = this.get('application3D.userData.model');
    removeFoundation(emberApplication, this.get('store'));

    this.set('applicationID', null);
    this.set('application3D', null);

    this.set('interaction.raycastObjects', this.get('scene.children'));
  },

  /*
    This method is used to add the 3D depiction of the application to the landscape
  */
  add3DApplicationToLandscape(application, position, rotation) {
    const self = this;

    if (application.get('components').get('length') !== 0) {

      const foundation = createFoundation(application, self.get('store'));

      // Draw application in application-view
      applyCityLayout(application);

      self.set('applicationID', application.id);

      self.set('application3D', new THREE.Object3D());
      self.get('application3D').name = 'app3D';
      self.set('application3D.userData.model', application);

      // update raycasting children, because of new entity  
      //this.get('interaction').updateEntities(this.get('application3D'));  

      // apply (possible) highlighting
      //this.get('interaction').applyHighlighting();

      /*if(!self.get('viewCenterPoint')) {
        self.set('viewCenterPoint', calculateAppCenterAndZZoom(application));
      }*/

      //const viewCenterPoint = self.get('viewCenterPoint');

      const accuCommunications = application.get('communicationsAccumulated');

      accuCommunications.forEach((commu) => {
        if (commu.source !== commu.target) {
          if (commu.startPoint && commu.endPoint) {

            const start = new THREE.Vector3();
            start.subVectors(commu.startPoint, position);
            start.multiplyScalar(0.5);

            const end = new THREE.Vector3();
            end.subVectors(commu.endPoint, position);
            end.multiplyScalar(0.5);

            if (start.y >= end.y) {
              end.y = start.y;
            } else {
              start.y = end.y;
            }

            let transparent = false;
            let opacityValue = 1.0;

            if (commu.state === "TRANSPARENT") {
              transparent = true;
              opacityValue = 0.4;
            }

            const material = new THREE.MeshBasicMaterial({
              color: new THREE.Color(0xf49100),
              opacity: opacityValue,
              transparent: transparent
            });

            const thickness = commu.pipeSize * 0.3;

            const pipe = cylinderMesh(start, end, material, thickness);

            pipe.userData.model = commu;
            pipe.name = 'app3D';


            self.get('application3D').add(pipe);

          }
        }
      });

      addComponentToScene(foundation, 0xCECECE);

      self.get('scene').add(self.get('application3D'));

      // Scale application
      self.get('application3D').scale.x = 0.01;
      self.get('application3D').scale.y = 0.01;
      self.get('application3D').scale.z = 0.01;

      // apply last position and rotation
      self.get('application3D').position.set(position.x, position.y, position.z);
      self.get('application3D').rotation.set(rotation.x, rotation.y, rotation.z);
      
      // Store application mesh for redraw
      self.set('app3DMesh', self.get('application3D'));

      self.set("app3DExists", true);

      // setup interaction for app3d  
      self.get('interaction').setupInteractionApp3D(self.get('application3D'));

    }

    // calculate position for application
    /*function calculateAppCenterAndZZoom(emberApplication) {

      const MIN_X = 0;
      const MAX_X = 1;
      const MIN_Y = 2;
      const MAX_Y = 3;
      const MIN_Z = 4;
      const MAX_Z = 5;

      const foundation = emberApplication.get('components').objectAt(0);

      const rect = [];
      rect.push(foundation.get('positionX'));
      rect.push(foundation.get('positionY') + foundation.get('width'));
      rect.push(foundation.get('positionY'));
      rect.push(foundation.get('positionY') + foundation.get('height'));
      rect.push(foundation.get('positionZ'));
      rect.push(foundation.get('positionZ') + foundation.get('depth'));

      //const SPACE_IN_PERCENT = 0.02;

      const viewCenterPoint = new THREE.Vector3(rect.get(MIN_X) + 
        ((rect.get(MAX_X) - rect.get(MIN_X)) / 2.0),
        rect.get(MIN_Y) + ((rect.get(MAX_Y) - rect.get(MIN_Y)) / 2.0),
        rect.get(MIN_Z) + ((rect.get(MAX_Z) - rect.get(MIN_Z)) / 2.0));

      /*let requiredWidth = Math.abs(rect.get(MAX_X) - rect.get(MIN_X));
      requiredWidth += requiredWidth * SPACE_IN_PERCENT;

      let requiredHeight = Math.abs(rect.get(MAX_Y) - rect.get(MIN_Y));
      requiredHeight += requiredHeight * SPACE_IN_PERCENT;

      const viewPortSize = self.get('webglrenderer').getSize();

      let viewportRatio = viewPortSize.width / viewPortSize.height;

      const newZ_by_width = requiredWidth / viewportRatio;
      const newZ_by_height = requiredHeight;

      const center = new THREE.Vector3(rect.get(MIN_X) + ((rect.get(MAX_X) 
      - rect.get(MIN_X)) / 2.0),
        rect.get(MIN_Y) + ((rect.get(MAX_Y) - rect.get(MIN_Y)) / 2.0), 0);

      const camera = self.get('camera');

      camera.position.z = Math.max(Math.max(newZ_by_width, newZ_by_height), 
      10.0);
      camera.position.x = 0;
      camera.position.y = 0;
      camera.updateProjectionMatrix(); // old comment

      return viewCenterPoint;

    }*/

    function cylinderMesh(pointX, pointY, material, thickness) {
      const direction = new THREE.Vector3().subVectors(pointY, pointX);
      const orientation = new THREE.Matrix4();
      orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
      orientation.multiply(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1));
      const edgeGeometry = new THREE.CylinderGeometry(thickness, thickness, direction.length(), 20, 1);
      const pipe = new THREE.Mesh(edgeGeometry, material);
      pipe.applyMatrix(orientation);

      pipe.position.x = (pointY.x + pointX.x) / 2.0;
      pipe.position.y = (pointY.y + pointX.y) / 2.0;
      pipe.position.z = (pointY.z + pointX.z) / 2.0;
      return pipe;
    }
    /*
      This method is used to add the application to the scene
    */
    function addComponentToScene(component, color) {

      const grey = 0xCECECE;
      const lightGreen = 0x00BB41;
      const darkGreen = 0x169E2B;
      const clazzColor = 0x3E14A0;
      const redHighlighted = 0xFF0000;

      createBoxApp(component, color, false);

      component.set('color', color);

      const clazzes = component.get('clazzes');
      const children = component.get('children');

      clazzes.forEach((clazz) => {
        if (component.get('opened')) {
          if (clazz.get('highlighted')) {
            createBoxApp(clazz, redHighlighted, true);
          } else {
            createBoxApp(clazz, clazzColor, true);
          }
        }
      });

      children.forEach((child) => {
        if (component.get('opened')) {
          if (child.get('opened')) {
            if (component.get('color') === grey) {
              addComponentToScene(child, lightGreen);
            } else if (component.get('color') === darkGreen) {
              addComponentToScene(child, lightGreen);
            } else {
              addComponentToScene(child, darkGreen);
            }
          } else {
            if (component.get('color') === grey) {
              addComponentToScene(child, lightGreen);
            } else if (component.get('color') === darkGreen) {
              addComponentToScene(child, lightGreen);
            } else {
              addComponentToScene(child, darkGreen);
            }
          }
        }
      });
    } // END addComponentToScene

    // Create the Box for app
    function createBoxApp(component, color, isClass) {

      let centerPoint = new THREE.Vector3(component.get('positionX') +
        component.get('width') / 2.0, component.get('positionY') +
        component.get('height') / 2.0,
        component.get('positionZ') + component.get('depth') / 2.0);

      const material = new THREE.MeshLambertMaterial();

      material.color = new THREE.Color(color);

      //centerPoint.sub(self.get('viewCenterPoint'));

      centerPoint.multiplyScalar(0.5);

      const extension = new THREE.Vector3(component.get('width') / 2.0,
        component.get('height') / 2.0, component.get('depth') / 2.0);

      const cube = new THREE.BoxGeometry(extension.x, extension.y, extension.z);

      const mesh = new THREE.Mesh(cube, material);

      mesh.position.set(centerPoint.x, centerPoint.y, centerPoint.z);

      mesh.updateMatrix();

      mesh.userData.model = component;
      mesh.userData.name = component.get('name');
      mesh.userData.foundation = component.get('foundation');
      mesh.userData.type = isClass ? 'clazz' : 'package';

      mesh.userData.opened = component.get('opened');

      self.get('labeler').createLabel(mesh, self.get('application3D'),
        self.get('font'));

      if (color === 0xCECECE) {
        mesh.name = 'app3DFoundation';
      } else {
        mesh.name = 'app3D';
      }



      self.get('application3D').add(mesh);
      //component.set('threeJSModel', mesh);

    } // END createBoxApp


  }, // END add 3D application to the landscape


  // ONLY FOR DEBUGGIN
  debugPlane(x, y, z, width, height, color1, parent) {

    const material = new THREE.MeshBasicMaterial({
      color: color1,
      opacity: 0.4,
      transparent: true
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      material);

    plane.position.set(x, y, z);
    parent.add(plane);

  }

});