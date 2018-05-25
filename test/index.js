const assert = require('assert');

const vows = require('vows');

const FAYULogger = require('fayulogger');
const Transport = require('fayulogger/Transport');

const Sender = require('../Sender');//Отправитель
const Receiver = require('../Receiver');//Получатель

let sender = null;
let receiver = null;

let logger = null;

vows
    .describe('Main test')
        .addBatch({
            'Init Receiver': {
                topic: function() {
                    receiver = new Receiver();
                    (async () => {
                        return await receiver.connect();
                    })().then(res => {
                        this.callback(null, res)
                    }).catch(this.allback)
                },
                'Should return "true"': (err, res) => {
                    if(err) {
                        return assert.fail(err);
                    }
                    assert.ok(res);
                },
                'Prepare simple transport': {
                    topic: function() {
                        let logger = receiver.logger;
                        logger.addModule('test');
                        logger.addTransport(new Transport('test'));
                        logger.bind({
                            module: 'test',
                            transport: 'test',
                            level: 'debug'
                        })
                        return logger.getModule('test').transports;
                    },
                    'Verify transport in reveiver': function(topic) {
                        assert.ok(topic && topic instanceof Array && topic[0] == 'sender');
                    }
                }
            },
            'Init Sender': {
                topic: function() {
                    sender = new Sender('sender');
                    (async () => {
                        return await sender.connect();
                    })().then(res => {
                        this.callback(null, res);
                    }).catch(this.callback);
                },
                'Should return "true"': (err, res) => {
                    if(err)
                        return assert.fail(err);
                    assert.ok(res);
                },
                'Prepare logger with transport': {
                    topic: function() {
                        logger = new FAYULogger();
                        logger.addModule('sender');
                        logger.addTransport(sender);
                        logger.bind({
                            module: 'sender',
                            transport: 'sender',
                            level: 'debug'
                        })
                        return logger.getModule('sender').transports
                    },
                    'Should be transport array with 1 item "sender"': function(topic) {
                        assert.ok(topic && topic instanceof Array && topic[0] == 'sender');
                    }
                }
            }
        })
        .addBatch({
            'Test debug': {
                topic: function() {
                    let transport = receiver.logger.getTransport('test');
                    transport.on('debug', this.callback);
                    logger.getModule('sender').debug('debug');
                },
                'Verify event "debug"': function(topic) {
                    assert.equal(topic, 'test: debug');
                }
            },
            'Test info': {
                topic: function() {
                    let transport = receiver.logger.getTransport('test');
                    transport.on('info', this.callback);
                    logger.getModule('sender').info('info');
                },
                'Verify event "debug"': function(topic) {
                    assert.equal(topic, 'test: info');
                }
            },
            'Test warning': {
                topic: function() {
                    let transport = receiver.logger.getTransport('test');
                    transport.on('warn', this.callback);
                    logger.getModule('sender').debug('warn');
                },
                'Verify event "warn"': function(topic) {
                    assert.equal(topic, 'test: warn');
                }
            },
            'Test severe': {
                topic: function() {
                    let transport = receiver.logger.getTransport('test');
                    transport.on('severe', this.callback);
                    logger.getModule('sender').debug('severe');
                },
                'Verify event "severe"': function(topic) {
                    assert.equal(topic, 'test: severe');
                }
            },
            'Test error': {
                topic: function() {
                    let transport = receiver.logger.getTransport('test');
                    transport.on('error', this.callback);
                    logger.getModule('sender').debug('error');
                },
                'Verify event "error"': function(topic) {
                    assert.equal(topic, 'test: error');
                }
            },
            'Test fatal': {
                topic: function() {
                    let transport = receiver.logger.getTransport('test');
                    transport.on('fatal', this.callback);
                    logger.getModule('sender').debug('fatal');
                },
                'Verify event "fatal"': function(topic) {
                    assert.equal(topic, 'test: fatal');
                }
            },
        })
        .addBatch({
            'Close sender': {
                topic: function() {
                    return logger.close();
                },
                'Closed': function(topic) {
                    assert.ok(topic);
                }
            },
            'Close receiver': {
                topic: function() {
                    return receiver.close();
                },
                'Closed': function(topic) {
                    assert.ok(topic);
                }
            }
        })
    .export(module);