'use strict';
var assert = require('assert');
var Discovery = require('../index.js').Discovery;
var discover = new Discovery();

var serv = {
    annInterval: 500,
    port: 80,
    proto: 'tcp',
    addrFamily: 'IPv4',
    userData: {
        name: 'Edmond',
        day: 2233,
        week: [ 'monday', 'tuesday', 'wednesday', 'thursday', 'friday' ]
    }
};

var count = 0;

describe('udp-discovery', function() {
    it('should remove the service from the table in less than 2100 ms', function(cb) {
        this.timeout(2100);
        discover.on('available', function(name, data, reason) {
            count++;
            assert.ok(count === 1);
            assert.ok(reason==='new');
        });

        discover.on('unavailable', function(name, data, reason) {
            count++;
            assert.ok(count === 2);
            console.log('reason',reason);
            assert.ok(reason==='timedOut');
            assert.ok(typeof discover.services !== 'undefined');
            console.log(typeof discover.services.test);
            assert.ok(typeof discover.services.test === 'undefined');
            cb();
        });

        discover.announce('test', serv, 500, true);
        discover.pause('test');
    });
});
