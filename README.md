ts-udp-discovery
=============
This module provides discovery services using UDP multicast. ts-udp-discovery
implements the zero-configuration UDP multicast discovery and works only between
nodes on the same subnet as typically, broadcast packets don't route.

# Installation

    yarn add ts-udp-discovery

# Example

## Application sending advertisements

```JavaScript
var Discovery = require('udp-discovery').Discovery;
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
```

## Application receiving advertisements

```JavaScript
var Discovery = require('udp-discovery').Discovery;
var discover = new Discovery();

discover.on('available', function(name, data, reason) {
  console.log('available ',name);
  console.log('data',data);
  console.log('reason',reason);
  var obj = {a: 1, b: '2', c: true, d: {e: 333}};
  discover.sendEvent('Hello', obj);

  console.log(name,':','available:',reason);
  console.log(data);
});

discover.on('unavailable', function(name, data, reason) {
  console.log(name,':','unavailable:',reason);
  console.log(data);
});
```

# Discovery constructor

## new Discovery([options])

Invokes the constructor to create an instance of Discovery to receive discovery
events.  The config options object is optional, but if included, the following
options are available:

* **Number** `port` - The port to listen upon for service announcements. Default:
  44201.
* **String** `bindAddr` - The address to bind to. Default: listens to all
  interfaces.
* **String** `dgramType` - Either 'udp4' or 'udp6'. Default: 'udp4'.

# Discovery methods

## announce(name, userData, \[,interval\] \[,available\])
Starts announcing the service at the specified interval. The parameter,
`serviceObject`, is an object describing the service that udp-discoveryy
announces.

* **String** `name` The name of the service being announced. It must be unique, or
  it will collide with another.
* **Number** `interval` The duration between announcements in milliseconds.
* **Any** `userData` Any data that can be serialized into JSON.
* **Boolean** `available` Optional parameter to set availability of the service.
  If not specified, the default is 'true', meaning available.

Any property with a default can be left out and the code supplies the default
value. The name and data are required.

## pause(name)
- **String** `name` The name of the service.
- *Returns* true if successful, false otherwise.

Halts announcements.

## resume(name, \[,interval\])
- **String** `name` name of the service.
- **Number** [`interval`] optional interval between announcements in ms.
- *Returns* true if successful, false otherwise.

Resumes the announcements at the time interval.

## getData(name)
- **String** `name` name of the service.
- *Returns* **Object** serviceObject from announce.

*Returns* the service object, which can be modified. For example, if you need to
alter the `userData`, you can. You cannot, however, alter the name (it's a
constant property).

## update(name, userData \[,interval\] \[,available\])
Updates the existing service.

* **String** `name` The name of the service being announced. It must be unique, or
  it will collide with another.
* **Any** `userData` Any data that can be serialized into JSON.
* **Number** [`interval`] Optional duration between announcements in milliseconds.
* **Boolean** [`available`] Optional parameter to set availability of the service.
  If not specified, the default is 'true', meaning available.

# Discovery Events

## 'available'
Has the following parameters:

- **String** `name` name of the service.
- **Object** `data` user-defined object describing the service.
- **String** `reason` why this event was sent: 'new', 'availabilityChange',
  'timedOut'.

This event can happen when:

- The first announcement for a service is received.
- The availability changes, if the available status changes from false to true.

## 'unavailable'
Has the following parameters:

- **String** `name` name of the service.
- **Object** `data` user-defined object describing the service.
- **String** `reason` why this event was sent: 'new', 'availabilityChange',
  'timedOut'.

This event can happen when:

- The first announcement for a service is received and the service is
  unavailable..
- The availability changes, if the available status changes from true to false.
- When 2x the announce interval time for the service elapsed without an
  announcement being seen. The service is considered unavailable and removed
  from the list of services.

# License
Copyright (c) 2014 Edmond Meinfelder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
