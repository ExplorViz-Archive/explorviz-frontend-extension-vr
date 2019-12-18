/**
 * @author mrdoob / http://mrdoob.com
 * @author stewdio / http://stewd.io
 */

Controller = function (id) {

  THREE.Object3D.call(this);

  var scope = this;
  var gamepad;

  var axes = [0, 0];
  var thumbpadIsPressed = false;
  var triggerIsPressed = false;
  var gripIsPressed = false;
  var menuIsPressed = false;
  var timestamp = 0;
  var deleteCounter = 0;
  var connected = false;
  
  this.matrixAutoUpdate = false
  this.standingMatrix = new THREE.Matrix4();

  function findGamepad(id) {

    // Iterate across gamepads as Vive Controllers may not be
    // in position 0 and 1.

    var gamepads = navigator.getGamepads && navigator.getGamepads();

    for ( var i = 0, j = 0; i < gamepads.length; i ++ ) {

      var gamepad = gamepads[ i ];

      if(gamepad && (gamepad.id === 'OpenVR Gamepad' || gamepad.id.startsWith('Spatial Controller'))) {
        if (j === id)
          return gamepad;

        j ++;
      } else if(gamepad && gamepad.id.startsWith( 'Oculus Touch')) {
        if((id === 0 && gamepad.id === 'Oculus Touch (Left)')
          || (id === 1 && gamepad.id === 'Oculus Touch (Right)')) {
          return gamepad;
        }

        j++;
      }

    }

  }

  this.getGamepad = function () {
    return gamepad;
  };

  this.isConnected = () => {
    return connected;
  }

  this.getButtonState = function ( button ) {
    if(button === 'thumbpad') return thumbpadIsPressed;
    if(button === 'trigger') return triggerIsPressed;
    if(button === 'grip') return gripIsPressed;
    if(button === 'menu') return menuIsPressed;
    if(button === 'axes') return axes;
  };

  this.getTriggerValue = function () {
    if(gamepad) {
      return gamepad.buttons[1].value;
    }
    return 0.0;
  };

  this.update = function () {

    gamepad = findGamepad(id);

    if(gamepad !== undefined && gamepad.pose !== undefined && timestamp !== gamepad.timestamp) {

      timestamp = gamepad.timestamp;

      if(gamepad.pose === null) return; // No user action yet

      deleteCounter = 0;
      connected = true;

      // Position and orientation.

      var pose = gamepad.pose;

      // adjust y position here, because controllers else are too low 
      if(pose.position !== null )
        scope.position.fromArray(pose.position);

      if(pose.orientation !== null)
        scope.quaternion.fromArray(pose.orientation);

      scope.matrix.compose(scope.position, scope.quaternion, scope.scale);
      scope.matrix.multiplyMatrices(scope.standingMatrix, scope.matrix);
      scope.matrixWorldNeedsUpdate = true;
      scope.visible = true;

      // Thumbpad and Buttons.
      
      if (axes[0] !== gamepad.axes[0] || axes[1] !== gamepad.axes[1]) {
        axes[0] = gamepad.axes[0]; // X axis: -1 = Left, +1 = Right.
        axes[1] = gamepad.axes[1]; // Y axis: -1 = Bottom, +1 = Top.
        scope.dispatchEvent({ type: 'axischanged', axes: axes });
      }

      if ( thumbpadIsPressed !== gamepad.buttons[0].pressed ) {
        thumbpadIsPressed = gamepad.buttons[0].pressed;
        scope.dispatchEvent({ type: thumbpadIsPressed ? 'thumbpaddown' : 'thumbpadup', axes: axes });
      }

      if (triggerIsPressed !== gamepad.buttons[1].pressed) {
        triggerIsPressed = gamepad.buttons[1].pressed;
        scope.dispatchEvent({ type: triggerIsPressed ? 'triggerdown' : 'triggerup' });
      }


      if (typeof gamepad.buttons[2] != 'undefined' && gripIsPressed !== gamepad.buttons[2].pressed) {
        gripIsPressed = gamepad.buttons[2].pressed;
        scope.dispatchEvent({ type: gripIsPressed ? 'gripdown' : 'gripup' });
      }

      if (typeof gamepad.buttons[3] != 'undefined' && menuIsPressed !== gamepad.buttons[3].pressed) {
        menuIsPressed = gamepad.buttons[3].pressed;
        scope.dispatchEvent({ type: menuIsPressed ? 'menudown' : 'menuup' });
      }

    } else {
      // hide controller model if after 30 update calls the controller is still disconnected
      // (or its timestamp hasn't updated)
      // prevents flickering on the oculus rift
      if(++deleteCounter === 30) {
        scope.visible = false;
        connected = false;
      }
    }

  };

};

Controller.prototype = Object.create(THREE.Object3D.prototype);
Controller.prototype.constructor = THREE.Controller;
