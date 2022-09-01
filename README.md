# lgtv2mqtt


> Interface between LG WebOS Smart TVs and MQTT 📺


### Getting started


* Install

```npm install -g lgtv2mqtt```


* Start 

```lgtv2mqtt --help```  


### Topics subscribed by lgtv2mqtt


#### webos/set/mute

Enable or disable mute. Payload should be one off '0', '1', 'false' and 'true'.

#### webos/set/volume

Set volume. Expects value between 0 and 100.

#### webos/set/soundOutput

#### webos/set/toast

Show a Popup Message. Send Message as plain payload string.

#### webos/set/launch

Lauch an app. Send AppId as plain payload string.

#### webos/set/media.controls/play

#### webos/set/media.controls/pause

#### webos/set/media.controls/stop

#### webos/set/media.controls/rewind

#### webos/set/media.controls/fastForward

#### webos/set/system/turnOff

#### webos/set/com.webos.service.tv.display/set3DOn

#### webos/set/com.webos.service.tv.display/set3DOff

#### webos/set/move lgtv/set/drag

Send coordinates as JSON with attributes dx and dy of type number

Example payload: ```{"dx": 100, "dy": 0}```

#### webos/set/scroll

Send coordinates as JSON with attributes dx and dy of type number

#### webos/set/click

#### webos/set/button

Send button as plain string payload

Buttons that are known to work:
MUTE, RED, GREEN, YELLOW, BLUE, HOME, MENU, VOLUMEUP, VOLUMEDOWN, CC, BACK, UP, DOWN, LEFT, ENTER, DASH, 0-9, EXIT,
channelup, channeldown, record
                    
#### webos/set/youtube 

Youtube video ID as payload. Runs youtube app and opens video. If the payload is empty, just launch youtube app.       
                    
#### webos/set/netflix 

Netflix video ID as payload. Runs netflix app and opens video. If the payload is empty, just launch Netflix app.       
                       
      
#### webos/set/open 
Open URL within browser.

#### webos/set/open_max 
Open URL within browser and maximise the window.     

#### webos/set/power
Payload '1' or 'true': Power ON, using Wake on Lan, must set Environment Variables: BROADCAST_IP and TV_MAC  
Payload '0' or 'false': Power OFF                           

### topics published by lgtv2mqtt

#### webos/status/volume

Reports volume changes. Payload is the plain value.

#### webos/status/mute

Reports mute changes. Payload is 'false' (not muted) or 'true' (muted).

#### webos/status/soundOutput

#### webos/status/foregroundApp

Reports which App is currently in foreground. (example Payloads: 'netflix', 'com.webos.app.livetv', 'com.webos.app.hdmi2')

#### webos/status/currentChannel

Reports current channel if foregroundApp is 'com.webos.app.livetv'. Payload is a JSON String, property val contains the
channelNumber, underneath 'lgtv' you will find more properties with detailed information.


## License

MIT © [Sebastian Raff](https://github.com/hobbyquaker)

[mit-badge]: https://img.shields.io/badge/License-MIT-blue.svg?style=flat
[mit-url]: LICENSE
