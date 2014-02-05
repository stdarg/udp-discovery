'use strict';
var Discovery = require('../index.js').Discovery;
var discover = new Discovery();

var name = 'test';
var interval = 500;
var available = true;

var serv = {
  port: 80,
  proto: 'tcp',
  addrFamily: 'IPv4',
  bonus: {
    name: 'Edmond',
    day: 2233,
    week: [ 'monday', 'tuesday', 'wednesday', 'thursday', 'friday' ]
  }
};

discover.announce(name, serv, interval, available);

discover.on('MessageBus', function(event, data) {
  console.log('event:',event);
  console.log('data:',data);
});
