# ExplorViz-Frontend-Extension-VR

This extension adds a [WebVR](https://webvr.info/)-based Virtual Reality (VR) mode to ExplorViz, which allows collaborative exploration.

## Requirements
- [HTC Vive](https://www.vive.com) or [Oculus Rift CV1](https://www.oculus.com/rift/) with controllers and their respective firmware
- A powerful computer that can handle VR
- [Mozilla Firefox](https://www.mozilla.org/) Version 72.0.2
- [ExplorViz Backend](https://github.com/ExplorViz/explorviz-backend)
- [ExplorViz Backend Extension VR](https://github.com/ExplorViz/explorviz-backend-extension-vr)
- [ExplorViz Frontend](https://github.com/ExplorViz/explorviz-frontend)

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

### Vive Controllers:

#### Righty
<p align="left">
  <img src="https://github.com/ExplorViz/explorviz-frontend-extension-vr/blob/collaborative-improvements/public/images/vive_controls_righty" width="500"/>
</p>

#### Lefty
<p align="left">
  <img src="https://github.com/ExplorViz/explorviz-frontend-extension-vr/blob/collaborative-improvements/public/images/vive_controls_lefty"width="500"/>
</p>

### Rift Controllers:

#### Righty
<p align="left">
  <img src="https://github.com/ExplorViz/explorviz-frontend-extension-vr/blob/collaborative-improvements/public/images/oculus_controls_righty"width="500"/>
</p>

#### Lefty
<p align="left">
  <img src="https://github.com/ExplorViz/explorviz-frontend-extension-vr/blob/collaborative-improvements/public/images/oculus_controls_lefty"width="500"/>
</p>
