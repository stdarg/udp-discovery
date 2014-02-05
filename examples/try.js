'use strict';
var jsonQuery = require('json-query');
var inspect = require('util').inspect;

var services = [
  {
    name: 'test1',
    interval: 500,
    data: {
      port: 80,
      proto: 'tcp',
      addrFamily: 'IPv4',
      bonus: { name: 'Bill', day: 233, week: ['Monday'] }
    },
    available: true,
    local: false,
    addr: '172.16.32.205'
  },
  {
    name: 'test2',
    interval: 500,
    data: {
      port: 81,
      proto: 'tcp',
      addrFamily: 'IPv4',
      bonus: { name: 'Edmond', day: 33, week: ['Tuesday', 'Wednesday'] }
    },
    available: true,
    local: false,
    addr: '172.16.32.205'
  },
  {
    name: 'test3',
    interval: 500,
    data: {
      port: 82,
      proto: 'tcp',
      addrFamily: 'IPv4',
      bonus: { name: 'Arnold', day: 2200, week: ['Friday', 'Saturday'] }
    },
    available: true,
    local: false,
    addr: '172.16.32.205'
  },
];

var obj = {services: services};

//var result = jsonQuery('services[name=test1]', {rootContext: obj});
var result = jsonQuery('services[data.name=Edmond]', {rootContext: obj});
console.log(inspect(result, {colors:true, depth:null}));
