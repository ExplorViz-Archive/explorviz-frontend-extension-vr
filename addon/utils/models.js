import THREE from 'three';

//Declare globals
/*global createOBJLoader*/

const OBJLoader = createOBJLoader(THREE);
const loader = new OBJLoader(THREE.DefaultLoadingManager);
let hmdModel, oculusLeftControllerModel, oculusRightControllerModel, viveControllerModel;
let loadCount = 0;
let TOTAL_COUNT = 4;

/**
 * Load the Texture for the hmds of other users
 */
function loadHMDModel() {
  loader.setPath('/generic_hmd/');
  loader.load('generic_hmd.obj', object => {
    const obj = object;
    obj.name = "hmdTexture";
    let loader = new THREE.TextureLoader();
    loader.setPath('/generic_hmd/');
    obj.children[0].material.map = loader.load('generic_hmd.tga');
    hmdModel = obj;
    loadCount++;
  });
}

function loadOculusLeftControllerModel() {
  loader.setPath('/oculus_cv1_controller/');
  loader.load('oculus_cv1_controller_left.obj', object => {
    const obj = object;
    obj.name = "controllerTexture";
    let loader = new THREE.TextureLoader();
    loader.setPath('/oculus_cv1_controller/');
    let controller = obj.children[0];
    controller.material.map = loader.load('external_controller01_col.png');
    controller.material.specularMap = loader.load('external_controller01_spec.png');
    controller.rotateX(0.71);
    controller.position.x -= 0.0071;
    controller.position.y += 0.035;
    controller.position.z -= 0.035;
    oculusLeftControllerModel = obj;
    loadCount++;
  });
}

function loadOculusRightControllerModel() {
  loader.setPath('/oculus_cv1_controller/');
  loader.load('oculus_cv1_controller_right.obj', object => {
    const obj = object;
    obj.name = "controllerTexture";
    let loader = new THREE.TextureLoader();
    loader.setPath('/oculus_cv1_controller/');
    let controller = obj.children[0];
    controller.material.map = loader.load('external_controller01_col.png');
    controller.material.specularMap = loader.load('external_controller01_spec.png');
    controller.rotateX(0.71);
    controller.position.x += 0.0071;
    controller.position.y += 0.035;
    controller.position.z -= 0.035;
    oculusRightControllerModel = obj;
    loadCount++;
  });
}

function loadViveControllerModel() {
  loader.setPath('/vive-controller/');
  loader.load('vr_controller_vive_1_5.obj', object => {
    const obj = object;
    obj.name = "controllerTexture";
    let loader = new THREE.TextureLoader();
    loader.setPath('/vive-controller/');
    let controller = obj.children[0];
    controller.material.map = loader.load('onepointfive_texture.png');
    controller.material.specularMap = loader.load('onepointfive_spec.png');
    viveControllerModel = obj;
    loadCount++;
  });
}

export function getHMDModel() {
  return hmdModel.clone();
}

export function getOculusLeftControllerModel() {
  return oculusLeftControllerModel.clone();
}

export function getOculusRightControllerModel() {
  return oculusRightControllerModel.clone();
}

export function getViveControllerModel() {
  return viveControllerModel.clone();
}

export function areLoaded() {
  return loadCount === TOTAL_COUNT;
}

export function loadModels() {
  loadCount = 0;

  loadHMDModel();
  loadViveControllerModel();
  loadOculusLeftControllerModel();
  loadOculusRightControllerModel();
}
