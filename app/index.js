#!/usr/bin/env node

const Lgtv = require('lgtv2');
const pkg = require('../package.json');
const _ = require('lodash');
const logging = require('./logging.js');
const wol = require('wol');
const mqttHelpers = require('./mqtt-helpers.js');

let mqttConnected;
let tvConnected;
let lastError;
let foregroundApp = null;

const tvMAC = process.env.TV_MAC;
const tvIP = process.env.TV_IP;
const broadcastIP = process.env.BROADCAST_IP;
const clientKeyPath = process.env.CLIENT_KEY_PATH || '/usr/node_app/lgkey/';

const mqttOptions = {retain: false, qos: 0};
const topicPrefix = process.env.TOPIC_PREFIX;

if (_.isNil(topicPrefix)) {
    logging.error('TOPIC_PREFIX not set, not starting');
    process.abort();
}

logging.info(pkg.name + ' ' + pkg.version + ' starting');

const mqtt = mqttHelpers.setupClient(() => {
    mqttConnected = true;

    mqtt.publish(topicPrefix + '/connected', tvConnected ? '1' : '0', mqttOptions);

    logging.info('mqtt subscribe', topicPrefix + '/set/#');
    mqtt.subscribe(topicPrefix + '/set/#', {qos: 0});
}, () => {
    if (mqttConnected) {
        mqttConnected = false;
        logging.error('mqtt disconnected');
    }
});

const powerOff = function () {
    logging.info('power_off');
    logging.info('lg > ssap://system/turnOff');
    lgtv.request('ssap://system/turnOff', null, null);
};

const powerOn = function () {
    logging.info('power_on');
    wol.wake(tvMAC, {
        address: broadcastIP
    }, (err, response) => {
        logging.info('WOL: ' + response);
        if (foregroundApp === null) {
            logging.info('lg > ssap://system/turnOff (to turn it on...)');
            lgtv.request('ssap://system/turnOff', null, null);
        }
    });
};

const lgtv = new Lgtv({
    url: 'ws://' + tvIP + ':3000',
    reconnect: 1000,
    keyFile: `${clientKeyPath}keyfile-${tvIP.replace(/[a-z]+:\/\/([\w-.]+):\d+/, '$1')}`
});

mqtt.on('error', err => {
    logging.error('mqtt: ' + err);
});

mqtt.on('message', (inTopic, inPayload) => {
    let topic = inTopic;
    const payload = String(inPayload);
    logging.info('mqtt <' + topic + ':' + payload);

    if (topic[0] === '/') {
        topic = topic.slice(1);
    }

    const parts = topic.split('/');

    switch (parts[1]) {
        case 'set':
            switch (parts[2]) {
                case 'toast': {
                    logging.info(`lg > ssap://com.webos.notification/createToast:${payload}`);
                    lgtv.request('ssap://com.webos.notification/createToast', {message: String(payload)});
                    break;
                }

                case 'volume': {
                    const volume = Number.parseInt(payload);
                    logging.info(`lg > ssap://com.webos.service.audio/master/setVolume:${volume}`);
                    lgtv.request('ssap://com.webos.service.audio/master/setVolume', {volume});
                    break;
                }

                case 'mute': {
                    const mute = Boolean(!(payload === 'false'));
                    logging.info(`lg > luna://com.webos.service.apiadapter/audio/setMute:${mute}`);
                    lgtv.request('luna://com.webos.service.apiadapter/audio/setMute', {mute: Boolean(mute)});
                    break;
                }
                
                case 'soundOutput': {
                    logging.info(`lg > luna://com.webos.service.apiadapter/audio/changeSoundOutput:${payload}`);
                    lgtv.request('luna://com.webos.service.apiadapter/audio/changeSoundOutput', {output: String(payload)});
                    break;
                }

               case 'launch': {
                    try {
                        logging.info(`lg > ssap://com.webos.applicationManager/launch:${payload}`);
                        lgtv.request('ssap://com.webos.applicationManager/launch', {id: String(payload)});
                    } catch (error) {
                        logging.error(error);
                    }

                    break;
                }

                case 'move':
                case 'drag': {
                    try {
                        const jsonPayload = JSON.parse(payload);
                        // The event type is 'move' for both moves and drags.
                        sendPointerEvent('move', {
                            dx: jsonPayload.dx,
                            dy: jsonPayload.dy,
                            drag: parts[2] === 'drag' ? 1 : 0
                        });
                    } catch (error) {
                        logging.error(error);
                    }

                    break;
                }

                case 'scroll': {
                    try {
                        const jsonPayload = JSON.parse(payload);
                        sendPointerEvent('scroll', {
                            dx: jsonPayload.dx,
                            dy: jsonPayload.dy
                        });
                    } catch (error) {
                        logging.error(error);
                    }

                    break;
                }

                case 'click': {
                    sendPointerEvent('click');
                    break;
                }

                case 'power': {
                    if (payload === 'false' || payload === '0') {
                        powerOff();
                    } else {
                        powerOn();
                    }

                    break;
                }

                case 'button': {
                    /*
                     * Buttons that are known to work:
                     *    MUTE, RED, GREEN, YELLOW, BLUE, HOME, MENU, VOLUMEUP, VOLUMEDOWN,
                     *    CC, BACK, UP, DOWN, LEFT, ENTER, DASH, 0-9, EXIT, CHANNELUP, CHANNELDOWN
                     */
                    sendPointerEvent('button', {name: (String(payload)).toUpperCase()});
                    break;
                }

                case 'open':
                case 'open_max': {
                    lgtv.request('ssap://system.launcher/open', {target: String(payload)});
                    if (parts[2] === 'open_max') {
                        setTimeout(clickMax, 5000);
                    }

                    break;
                }

                case 'netflix': {
                    lgtv.request('ssap://system.launcher/launch', payload ? {
                        id: 'netflix',
                        contentId: `m=http://api.netflix.com/catalog/titles/movies/${payload}&source_type=4`
                    } : {
                        id: 'netflix'
                    });
                    break;
                }

                case 'youtube': {
                    lgtv.request('ssap://com.webos.applicationManager/launch', payload ? {
                        id: 'youtube.leanback.v4',
                        params: {
                            contentTarget: `https://www.youtube.com/tv?v=${payload}`
                        }
                    } : {id: 'youtube.leanback.v4'});
                    break;
                }


                default: {
                    const path = topic.replace(topicPrefix + '/set/', '');
                    const jsonPayload = payload ? JSON.parse(payload) : null;
                    logging.info(`lg > 'ssap://${path}:${payload || 'null'}`);
                    lgtv.request(`ssap://${path}`, jsonPayload);
                }
            }

            break;
        default:
    }
});

lgtv.on('prompt', () => {
    logging.info('authorization required');
});

lgtv.on('connect', () => {
    let channelsSubscribed = false;
    lastError = null;
    tvConnected = true;
    logging.info('tv connected');
    mqtt.publish(topicPrefix + '/connected', '1', mqttOptions);

    lgtv.subscribe('luna://com.webos.service.apiadapter/audio/getStatus', (err, response) => {
        logging.info('luna://com.webos.service.apiadapter/audio/getStatus', err, response);
        if (response.volumeStatus) {
                mqtt.publish(topicPrefix + '/status/volume', String(response.volumeStatus.volume), mqttOptions);
                mqtt.publish(topicPrefix + '/status/mute', String(response.volumeStatus.muteStatus), mqttOptions);
                mqtt.publish(topicPrefix + '/status/soundOutput', String(response.volumeStatus.soundOutput), mqttOptions);
            }
             else
            logging.error("Response different" + JSON.stringify(response));
    });

    lgtv.subscribe('luna://com.webos.applicationManager/getForegroundAppInfo', (err, response) => {
        logging.info('getForegroundAppInfo', err, response);
        mqtt.publish(topicPrefix + '/status/foregroundApp', String(response.appId), mqttOptions);

        if (!_.isNil(response.appId) && response.appId.length > 0) {
            foregroundApp = response.appId;
        } else {
            foregroundApp = null;
        }

        if (response.appId === 'com.webos.app.livetv') {
            if (!channelsSubscribed) {
                channelsSubscribed = true;
                setTimeout(() => {
                    lgtv.subscribe('ssap://tv/getCurrentChannel', (err, response) => {
                        if (err) {
                            logging.error(err);
                            return;
                        }

                        const message = {
                            val: response.channelNumber,
                            lgtv: response
                        };
                        mqtt.publish(topicPrefix + '/status/currentChannel', JSON.stringify(message), mqttOptions);
                    });
                }, 2500);
            }
        }
    });

    lgtv.subscribe('ssap://tv/getExternalInputList', (err, response) => {
        logging.info('getExternalInputList', err, response);
    });
});

lgtv.on('connecting', host => {
    logging.info('tv trying to connect', host);
});

lgtv.on('close', () => {
    lastError = null;
    tvConnected = false;
    logging.info('tv disconnected');
    mqtt.publish(topicPrefix + '/connected', '0', mqttOptions);
});

lgtv.on('error', err => {
    const string = String(err);
    if (string !== lastError) {
        logging.error('tv error: ' + string);
    }

    lastError = string;
});

const sendPointerEvent = function (type, payload) {
    logging.info(`lg > ssap://com.webos.service.networkinput/getPointerInputSocket | type: ${type} | payload: ${JSON.stringify(payload)}`);
    lgtv.getSocket(
        'ssap://com.webos.service.networkinput/getPointerInputSocket',
        (err, sock) => {
            if (!err) {
                sock.send(type, payload);
            }
        }
    );
};

const clickMax = function () {
    lgtv.getSocket('ssap://com.webos.service.networkinput/getPointerInputSocket',
        (err, sock) => {
            if (!err) {
                const command = 'move\ndx:11\ndy:-8\ndown:0\n\n';
                for (let i = 0; i < 22; i++) {
                    sock.send(command);
                }

                setTimeout(() => sock.send('click'), 1000);
            }
        });
};
