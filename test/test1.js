'use strict';
var assert = require('assert');
var Discovery = require('../index.js').Discovery;
var discover = new Discovery();

var serv = {
    port: 80,
    proto: 'tcp',
    annInterval: 1000,
    addrFamily: 'IPv4',
    moreData: {
        name: 'Edmond',
        day: 2233,
        week: [ 'monday', 'tuesday', 'wednesday', 'thursday', 'friday' ]
    }
};

var count = 0;

describe('udp-discovery', function() {
    it('should send a single initial event and then a time out', function(cb) {
        this.timeout(22000);
        discover.on('available', function(name, data, reason) {
            count++;
            assert.ok(count === 1);
            assert.ok(reason==='new');
        });

        discover.on('unavailable', function(name, data, reason) {
            count++;
            assert.ok(count === 2);
            assert.ok(reason==='timedOut');
            cb();
        });

        discover.announce('test', serv, 500, true);
        setTimeout(function() {
            discover.pause('test');
        }, 500);
    });
});
