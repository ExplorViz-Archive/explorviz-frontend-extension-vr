var path = require('path');
var mergeTrees = require('broccoli-merge-trees');
var Funnel = require('broccoli-funnel');

module.exports = {
  name: 'explorviz-frontend-extension-vr',

  isDevelopingAddon() {
      return true;
  },  
    
  treeForPublic: function(tree) {
    var assetsTree = new Funnel('public');
    return mergeTrees([tree, assetsTree], {
      overwrite: true
    });
  },

  included: function(app) {
    this._super.included.apply(this, arguments);

    app.import('vendor/vr/OBJLoader.js');
    app.import('vendor/vr/Controller.js');
    //app.import('vendor/vr/WebVR.js');
    app.import('vendor/vr/VRButton.js');
  }

};
