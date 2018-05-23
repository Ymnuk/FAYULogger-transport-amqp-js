const assert = require('assert');

const vows = require('vows');

const Sender = require('./Sender');//Отправитель
const Receiver = require('./Receiver');//Получатель

let sender = null;
let receiver = null;

vows
    .describe('Main test')
        .addBatch({
            'Init Receiver': {
                topic: function() {
                    receiver = new Receiver();
                    (async () => {
                        return await receiver.connect();
                    }).then(res => {
                        this.callback(null, res)
                    }).catch(this.allback)
                },
                'Should return "true"': (err, res) => {
                    if(err) {
                        return assert.fail(err);
                    }
                    assert.ok(res);
                }
            }
        })
        .addBatch({
            'Init Sender': {
                topic: function() {
                    sender = new Sender();
                    (async () => {
                        return await sender.connect();
                    }).then(res => {
                        this.callback(null, res);
                    }).catch(this.callback);
                }
            },
            'Should return "true"': (err, res) => {
                if(err)
                    return assert.fail(err);
                assert.ok(res);
            }
        })
    .export(module);