# ExplorViz-Frontend-Extension-VR

This extension adds a [WebVR](https://webvr.info/)-based Virtual Reality (VR) mode to ExplorViz.

## Requirements
- [HTC Vive](https://www.vive.com) or [Oculus Rift CV1](https://www.oculus.com/rift/) with controllers and their respective firmware
- A powerful computer that can handle VR
- Latest version of [Mozilla Firefox](https://www.mozilla.org/)
- [ExplorViz Backend](https://github.com/ExplorViz/explorviz-backend)
- [ExplorViz Frontend](https://github.com/ExplorViz/explorviz-frontend)

## Installation

1. Setup and install your head-mounted display (HMD)

2. Follow the installation guide of [ExplorViz frontend](https://github.com/ExplorViz/explorviz-frontend#development)

3. Change to the frontends directory in your CLI, e.g. `cd explorviz-frontend`

4. Install this extension via `ember install https://github.com/ExplorViz/explorviz-frontend-extension-vr.git`

## Running & Building

Follow the respective procedure in [ExplorViz frontend](https://github.com/ExplorViz/explorviz-frontend#running--development)

## Controls

### Vive Controllers:
<p align="left">
  <img src="https://github.com/ExplorViz/Docs/blob/master/images/vive_controller.png" width="500"/>
</p>

### Rift Controllers:
<p align="left">
  <img src="https://github.com/ExplorViz/Docs/blob/master/images/oculus_controllers.png" width="800"/>
</p>
You can target many objects in the virtual environment with the ray of the controller and interact with them through corresponding buttons. 
The ray of the left controller is colored black and that of the right one is colored green.
<p></p>

&#10122;:
(Left Controller):

Press this button to open the options menu. If in a menu, pressing the button can be used to navigate back through previous menus.

&#10123;:
(Left Controller):

Hold this button down to display a list of users connected to the server. Release the button to close the list.

&#10123;:
(Right Controller):

Target a 3D application with the ray of the controller and
keep this button pressed to bind the 3D application to the controller. The application now follows all movements of the controller. Release the button to stop this behavior.

&#10124;: 
(Left Controller):

Target the ground with the ray of the left controller and
press this button to teleport yourself to the displayed circle on the ground. Target the red "X" above a 3D application with the ray of the controller and press this button to delete the 3D application.
This button can also be used to select targeted clazzes and closed packages of a 3D application. Consequently the selected entity is colored red and the associated communication lines are highlighted. If nothing is targeted press this button again to unselect the entity and restore its color and the commuincation lines.

&#10124;:
(Right Controller):

Press this button to open/close targeted systems, nodegroups, packages and
create 3D applications out of targeted 2D applications. 
Target the red "X" above a 3D application with the ray of the controller and press this button to delete the 3D application.
This button can also the used to navigate through menus.

&#10125;:
(Right Controller):

Press this button to display information about the targeted entity.

### Keyboard:

- :arrow_up:: Move the camera upwards 
- :arrow_down:: Move the camera downwards 
- :arrow_left:: Move the camera leftwards
- :arrow_right:: Move the camera rightwards
- <kbd>+</kbd>: Move camera forwards (Zoom in)
- <kbd>-</kbd>: Move camera backward (Zoom out)
- <kbd>q</kbd>: Rotate the environment forwards
- <kbd>w</kbd>: Rotate the environment backwards
