# ExplorViz-Frontend-Extension-VR

This extension adds a [WebVR](https://webvr.info/)-based Virtual Reality (VR) mode to ExplorViz, which allows a collaborative exploration of software systems.

## Requirements
- [HTC Vive (Pro)](https://www.vive.com) or [Oculus Rift CV1](https://www.oculus.com/rift/) (basically [Oculus Rift S](https://www.oculus.com/rift-s/) is also supported) with controllers and their respective firmware
- A powerful computer that can handle VR
- [Mozilla Firefox](https://www.mozilla.org/) Version 72.0.2
- [ExplorViz Backend](https://github.com/ExplorViz/explorviz-backend) Version 1.5.0
- [ExplorViz Backend Extension VR](https://github.com/ExplorViz/explorviz-backend-extension-vr)
- [ExplorViz Frontend](https://github.com/ExplorViz/explorviz-frontend) Version 1.5.0

## Installation

1. Setup and install your head-mounted display (HMD)

2. Follow the installation guide of [ExplorViz frontend](https://github.com/ExplorViz/explorviz-frontend#development)

3. Change to the frontends directory in your CLI, e.g. `cd explorviz-frontend`

4. Install this extension via `ember install https://github.com/ExplorViz/explorviz-frontend-extension-vr.git`

## Running & Building

Follow the respective procedure in [ExplorViz frontend](https://github.com/ExplorViz/explorviz-frontend#running--development)

## Configuration

The IP address for the WebSocket connection(e.g. for user synchronization) to the backend can be configured in the file `public/config/config_multiuser.json`. The default address for the WebSocket connection is *localhost*.
The IP address for RESTful data exchange(e.g. for landscape data) is still configured via environments of the [ExplorViz frontend](https://github.com/ExplorViz/explorviz-frontend#running--development).


## Controls
The extension can be used in standard right-handed mode or the left-handed mode can be set. The controls for the [Oculus Rift S](https://www.oculus.com/rift-s/) are similar to those of the [Oculus Rift CV1](https://www.oculus.com/rift/).

### HTC Vive (Pro) Controls (right-handed):

<p align="left">
  <img src="https://github.com/ExplorViz/explorviz-frontend-extension-vr/blob/collaborative-improvements/public/images/vive_controls_righty.png" width="1000"/>
</p>

### HTC Vive (Pro) Controls (left-handed):

<p align="left">
  <img src="https://github.com/ExplorViz/explorviz-frontend-extension-vr/blob/collaborative-improvements/public/images/vive_controls_lefty.png"width="1000"/>
</p>

### Oculus Rift CV1 Controls (right-handed):

<p align="left">
  <img src="https://github.com/ExplorViz/explorviz-frontend-extension-vr/blob/collaborative-improvements/public/images/oculus_controls_righty.png"width="1000"/>
</p>


### Oculus Rift CV1 Controls (left-handed):

<p align="left">
  <img src="https://github.com/ExplorViz/explorviz-frontend-extension-vr/blob/collaborative-improvements/public/images/oculus_controls_lefty.png"width="1000"/>
</p>
