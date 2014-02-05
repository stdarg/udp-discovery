/**
 * @fileOverview
 * A simple UDP multicast discovery. The Discovery object is acquired with
 * getDiscovery. Announcements are sent out at intervals that may be unique to
 * each service. If an announcement is not seen in 2x the advertised
 * announcement interval, the service is marked as unavailable.
 *
 * The Discovery object emits a single event, 'available' that is sent when the
 * service is first seen, an available service times out with no announcements
 * or the service changes its availability status.
 */
'use strict';
var dgram = require('dgram');
var util = require('util');
var inspect = util.inspect;
var events = require('events');
var debug = require('debug')('udp-discovery');
var is = require('is2');
var objToJson = require('obj-to-json');

// Constants
var MULTICAST_ADDRESS = '224.0.0.234';
var DEFAULT_UDP_PORT = 44201;
var DEFAULT_TIMEOUT = 1000;
var DEFAULT_INTERVAL = 3000;
var DEFAULT_DGRAM_TYPE = 'udp4'; // could also be 'udp6'
var GLOBAL_EVENT_NAME = 'MessageBus';

// We use events and must inherit from events.EventEmitter
util.inherits(Discovery, events.EventEmitter);

// export the object for users of the module.
exports.Discovery = Discovery;

/**
 * Creates a Discovery object. The options object is optional. Supported
 * options are:
 *   - port - Set the port the service listens on for announcements default:
 *     44201
 *   - bindAddr - bind to an address
 *   - dgramType - Either 'udp4' or 'udp6', default: 'udp4'.
 *   - timeOutInt - duration of time between timeout checks in ms. Default 1000.
 * @param {Object} [options] An optional configuration object.
 * @constructor
 */
function Discovery(options) {
    var self = this;

    if (options && !is.obj(options))
        debug('Dicovery constructor bad options argument: '+inspect(options));

    // Create a dgram socket and bind it
    self.dgramType = (options && options.dgramType) ?
                      options.dgramType.toLowerCase() : DEFAULT_DGRAM_TYPE;
    self.socket = dgram.createSocket(self.dgramType);
    self.port = (options && options.port) ? options.port : DEFAULT_UDP_PORT;
    self.bindAddr = (options && options.bindAddr) ? options.bindAddr :
                     undefined;
    self.socket.bind(self.port, self.bindAddr);

    // create an interval task to check for announcements that have timed out
    self.timeOutInt = (options && options.timeOutInt) ? options.timeOutInt :
                                        DEFAULT_TIMEOUT;
    self.timeOutId = setInterval(function() { self.handleTimeOut(); },
                                                             self.timeOutInt);

    // listen and listen for multicast packets
    self.socket.on('listening', function() {
        self.socket.addMembership(MULTICAST_ADDRESS);
    });

    // handle any announcements, here we just do the formatting
    self.socket.on('message', function(message, rinfo) {
        if (message) {
            var obj = objToJson.jsonParse(message.toString());
            if (!obj) {
                debug('bad announcement: '+message.toString());
                return;
            }

            // the received message was either an event or an announcement
            if (obj.eventName)
                self.emit(GLOBAL_EVENT_NAME, obj.eventName, obj.data);
            else
                self.handleAnnouncement(obj, rinfo);
        }
    });
}

/**
 * Sets up announcements for a service.
 * @param {String} name The name of the service to announce. Required.
 * @param {Object} userData Any data the user desires, must be serializable to
 *      JSON.
 * @param {Number} [interval] The duration between announcements. If not
 *      specified, the default is 3000 ms.
 * @param {Boolean} [available] OPtional parameter setting the state of the
 *      service. If not included, the default is true meaning available.
 * @return {Boolean} true, if successful false otherwise.
 */
Discovery.prototype.announce = function(name, userData, interval, available) {
    if (!is.nonEmptyStr(name)) {
        debug('accounce error: bad name: '+inspect(name));
        return false;
    }

    if (!userData) {
        debug('announce error: no userData: what is being announced?');
        return false;
    }

    if (!is.positiveInt(interval))    interval = DEFAULT_INTERVAL;
    if (!available)    available = true;

    // make a copy of the userData object
    var userDataCopy = objToJson.copyObj(userData);
    if (!userDataCopy)    return false;
    debug('userDataCopy:'+inspect(userDataCopy));

    // attempt to add the announcement return result to user
    var announce = true;
    return this.addNew(name, userDataCopy, interval, available, announce);
};

/**
 * Pause announcements for a service.
 * @param {String} name The name of the service to resume announcements.
 * @return {Boolean} true, if successful false otherwise.
 */
Discovery.prototype.pause = function(name) {
    // we have to have a name that is string and not empty
    if (!is.nonEmptyStr(name)) {
        debug('stopAnouncement: bad name param: '+inspect(name));
        return false;
    }

    if (!is.nonEmptyObj(this.services)) {
        debug('stopAnnounce: There are no services to stop');
        return false;
    }

    // the service has to be already known to stop announcing
    if (!this.services[name]) {
        debug('Discovery.stopAnnounce error: no entry for \''+name+'\'');
        return false;
    }

    // if there is no task to do the announcing, quit
    if (!this.services[name].intervalId) {
        debug('Discovery.stopAnnounce error: not announcing \''+name+'\'');
        return false;
    }

    // clear the interval and remove the intervalId property
    clearInterval(this.services[name].intervalId);
    delete this.services[name].intervalId;
    return true;
};

/**
 * Resumes announcements for a service.
 * @param {String} name The name of the service to resume announcements.
 * @param {Number} [interval] The duration in ms between announcements.
 *      Optional.
 * @return {Boolean} true, if successful false otherwise.
 */
Discovery.prototype.resume = function(name, interval) {
    var self = this;
    // we need a name that is a string which is not empty
    if (!is.nonEmptyStr(name)) {
        debug('Discovery.resumeAnnounce error: invalid name: '+inspect(name));
        return false;
    }

    if (!is.positiveint(interval))  interval = DEFAULT_INTERVAL;

    // the service has to be known to resume
    if (!self.services || !self.services[name]) {
        debug('resumeAnnounce error: no entry for \''+name+'\'');
        return false;
    }

    // there can't be an interval task doing announcing to resume
    if (self.services[name].intervalId) {
        debug('resumeAnnounce error: already announcing \''+name+'\'');
        return false;
    }

    if (interval)  self.services[name].annInterval = interval;

    // create a function to send the announcement using the closure to retain
    // the name and self
    var sendAnnouncement = function() {
        self.sendAnnounce(self.services[name]);
    };

    // create an interval task and store the id on the service entry
    self.services[name].intervalId = setInterval(sendAnnouncement,
      self.services[name].annInterval);

    return true;
};

/**
 * Allows for updating of service data.
 * @param {String} name The name of the service to update. Required.
 * @param {Object} userData Any data the user desires, must be serializable to
 *      JSON. Required.
 * @param {Number} [interval] The duration between announcements. Default 3000
 *      ms.
 * @param {Boolean} [available] OPtional parameter setting the state of the
 *      service. If not included, the default is true meaning available.
 * @return {Boolean} true, if successful false otherwise.
 */
Discovery.prototype.update = function(name, userData, interval, available) {
    if (!is.nonEmptyStr(name)) {
        debug('update error: missing name: '+inspect(name));
        return false;
    }

    if (!userData) {
        debug('update error: no userData: what is being announced?');
        return false;
    }

    if (!is.positiveInt(interval))    interval = DEFAULT_INTERVAL;
    if (!available)    available = true;

    // make a copy of the userData object
    var userDataCopy = objToJson.copyObj(userData);
    if (!userDataCopy)    return false;

    // attempt to add the announcement return result to user
    return this.updateExisting(name, userDataCopy, interval, available);
};

/**
 * Adds new announcements to the services object. Takes care of adding missing
 * values that have defaults, making the name property constant, and emitting
 * the correct events.
 * @param {String} name The name of the service to announce. Required.
 * @param {Object} userData Any data the user desires, must be serializable to
 *      JSON. Required.
 * @param {Number} [interval] The duration between announcements. Default 3000
 *      ms, if not specified.
 * @param {Boolean} [available] OPtional parameter setting the state of the
 *      service. If not included, the default is true meaning available.
 * @param {Boolean} [announce] Optional parameter do we send the net
 *      announcement. Default is treu.
 * @return {Boolean} true, if successful false otherwise.
 */
Discovery.prototype.addNew = function(name, userData, interval, available,
                                      announce, rinfo) {
    var self = this;
    debug('addNew');
    if (!is.nonEmptyStr(name)) {
        debug('addNew error: missing name: '+inspect(name));
        return false;
    }

    if (!userData) {
        debug('addNew error: no userData: what is being announced?');
        return false;
    }

    // add defaults, if needed
    if (!is.positiveNum(interval))    interval = DEFAULT_INTERVAL;
    if (!available)    available = true;

    // create the services storage if need be
    if (!self.services)    self.services = {};

    // The entry should not already exist
    if (self.services[name]) {
        debug('addNew for \''+name+'\', but it already exists.');
        return false;
    }

    self.services[name] = {};
    self.services[name].name = name;
    self.services[name].interval = interval;
    self.services[name].data = userData;
    self.services[name].available = available;
    //self.services[name].announce = announce;
    // if local is true, the service is local to this process.
    self.services[name].local = announce;

    // if there is an rinfo, copy it and place it on the service
    // we don't need the size parameter, though.
    if (is.obj(rinfo) && is.nonEmptyStr(rinfo.address))
        self.services[name].addr = rinfo.address;

    // set the name property to be read-only - it would be confusing if it
    // changed as it is also the key.
    Object.defineProperty(self.services[name], 'name', {
        value: name,
        writable: false,
        enumerable: true,
        configurable: true
    });

    // since it's new - send an event
    var evName = available ? 'available' : 'unavailable';
    self.emit(evName, name, self.services[name], 'new');

    // update the lanst announcement time to now
    self.services[name].lastAnnTm = Date.now();

    // create a function to send the announcement using the closure to retain
    // the name and self
    var sendAnnouncement = function() {
        self.sendAnnounce(self.services[name]);
    };

    // create an interval task to repeatedly send announcements
    if (announce) {
        self.services[name].intervalId = setInterval(sendAnnouncement,
                                                     interval);
    }

    return true;
};

/**
 * update an existing service entry. Only works on services created locally.
 * @param {String} name The name of the service to announce. Required.
 * @param {Object} userData Any data the user desires, must be serializable to
 *      JSON. Required.
 * @param {Number} interval The duration between announcements. Default 3000 ms.
 * @param {Boolean} [available] OPtional parameter setting the state of the
 *      service. If not included, the default is true meaning available.
 * @param {Object} [rinfo] Optional parameter for remote address
 * @return {Boolean} true if successful, false otherwise.
 */
Discovery.prototype.updateExisting = function(name, data, interval, available,
                                              rinfo) {
    // this is an existing entry
    var oldAvail = this.services[name].available;
    // update the lanst announcement time to now
    this.services[name].interval = interval;
    this.services[name].data = data;

    // if there is an rinfo, copy it and place it on the service
    // we don't need the size parameter, though.
    if (is.obj(rinfo) && is.str(rinfo.address) && !this.services[name].addr)
        this.services[name].addr = rinfo.address;

    // if the availability changed, send an event
    if (available !== oldAvail) {
        this.services[name].available = available;
        var evName = available ? 'available' : 'unavailable';
        this.emit(evName, name, this.services[name], 'availabilityChange');
    }

    return true;
};

/**
 * Receives and processes announcements for a service.
 * @param {Object} ann The object describing the service.
 * @param {Object} [rinfo] An object with the sender's address information.
 * @return {Boolean} true, if successful false otherwise.
 * @private
 */
Discovery.prototype.handleAnnouncement = function(ann, rinfo) {
    // ensure the ann is an object that is not empty
    if (!is.nonEmptyObj(ann)) {
        debug('handleAnnouncement bad ann: '+inspect(ann));
        return false;
    }

    // also, the ann obj needs a name
    if (!ann.name) {
        debug('handleAnnouncement error: no name.');
        return false;
    }

    // The entry exists, update it
    if (this.services && this.services[ann.name]) {
        this.services[ann.name].lastAnnTm = Date.now();
        return this.updateExisting(ann.name, ann.data, ann.interval,
                                   ann.available,
                                  rinfo);
    }

    // the entry is new, add it
    var announce = false;
    return this.addNew(ann.name, ann.data, ann.interval, ann.available,
                       announce, rinfo);
};

/**
 * Retrieves service information by name.
 * @param {String} name The name of the service for which you want data.
 * @return {Object|Boolean} The object describing the srevice if available, and
 *     false otherwise.
 */
Discovery.prototype.getData = function(name) {
    // handle conditions for which there is no answer
    if (!name || typeof name !== 'string' || !name.length)    return false;
    if (!this.services || !this.services[name])    return false;
    // Developers just want annoucement data, send that.
    return this.services[name].data;
};

/**
 * Setup to send announcements for a service over UDP multicast.
 * @param {Object} data The service to announce.
 * @return {Boolean} true, if successful false otherwise.
 * @private
 */
Discovery.prototype.sendAnnounce = function(data) {
    if (!is.nonEmptyObj(data)) {
        debug('sendAnnounce has a bad param for data: '+inspect(data));
        return false;
    }

    var copy = objToJson.copyObj(data);
    delete copy.lastAnnTm;
    delete copy.intervalId;

    var str = objToJson.jsonStringify(copy);
    if (!str) {
        debug('objToJson.jsonStringify failed on serice data: '+inspect(data));
        return;
    }

    // send the stringified buffer over multicast
    var buf = new Buffer(str);
    this.socket.send(buf, 0, buf.length, this.port, MULTICAST_ADDRESS);
};

/**
 * Handle timeouts on announcements. Deletes timed out entries from services.
 * @param {Object} discObj A Discovery object.
 * @private
 */
Discovery.prototype.handleTimeOut = function() {
    var self = this;

    // Also the object should have a services storage on it
    if (!self.services || !Object.keys(self.services).length) {
        //debug('handleTimeOut no services, exiting.');
        return;
    }

    var now = Date.now();                         // timestamp in ms
    var services = self.services;    // quick ref for storage

    // iterate over all the properties in hash object
    for (var name in services) {
        // every object should have a timestamp - what's up here?
        if (!services[name].lastAnnTm) {
            debug('handleTimeOut: service \''+name+'\' has no time stamp. '+
                  'Adding one.');
            continue;
        }

        // if the time since the last announce is greater than 2X the
        // announcement interval, we timed out.
        if ((now - services[name].lastAnnTm) > (2*services[name].interval)) {
            var data = services[name].data;
            data.available = false;
            delete services[name];
            self.emit('unavailable', name, self.services[name], 'timedOut');
        }
    }
};

/**
 * Send an event to all discovered services.
 * @param {String} eventName The name of the event.
 * @param {Object} [data] User data sent along with the event. Optional.
 * @return {Boolean} true, if successful false otherwise.
 */
Discovery.prototype.sendEvent = function(eventName, data) {
    if (!is.nonEmptyStr(eventName)) {
        debug('sendEvent has a bad param for eventName: '+inspect(eventName));
        return false;
    }

    return this.sendEventToAddress(MULTICAST_ADDRESS, eventName, data);
};

/**
 * Send an event to a service, an array of services, or services matching a
 * query.
 * @param {String|Array|FUnction} dest The service name, an array of services
 *      or a query to select serices.
 * @param {String} eventName The name of the event.
 * @param {Object} [data] User data sent along with the event. Optional.
 * @return {Boolean} true on success, false otherwise.
 */
Discovery.prototype.sendEventTo = function(dest, eventName, data) {
    if (!is.nonEmptyStr(dest) && !is.nonEmptyArray(dest) &&
        !is.function(dest)) {
        debug('Discovery.sendEventTo received bad dest parameter: '+
              inspect(dest));
        return false;
    }

    if (!is.nonEmptyStr(eventName)) {
        debug('Discovery.sendEventTo received bad name parameter: '+
              inspect(eventName));
        return false;
    }

    var i;
    // handle the case where dest is a service name
    if (is.nonEmptyStr(dest)) {
        this.sendEventToService(dest, eventName, data);
    } else if (is.nonEmptyArray(dest)) {
        for (i=0; i<dest.length; i++)
            this.sendEventToService(dest[i], eventName, data);
    } else if (is.function(dest)) {
        var queryFunc = dest;
        var matches = [];
        for (i=0; i<this.services; i++) {
            if (queryFunc(this.services[i]) === true)
                matches.push(this.services[i]);
        }
        for (i=0; i<matches.length; i++) {
            this.sendEventToService(matches[i].name, eventName, data);
        }
    }
    return true;
};

/**
 * Send event to either the local process or remote process.
 * @param {String} name The name of the service to receive the message.
 * @param {Object} [data] Optional user data to send with message.
 * @return {Boolean} true on success, false otherwise.
 * @private
 */
Discovery.prototype.sendEventToService = function(name, eventName, data) {
    if (!is.nonEmptyStr(name)) {
        debug('Discovery.sendEvent received bad name parameter: '+
              inspect(name));
        return false;
    }

    if (!this.services[name])    {
        debug('Discovery.sendEvent no such service name as: '+inspect(name));
        return false;
    }

    if (!is.nonEmptyStr(eventName)) {
        debug('Discovery.sendEvent invalid event name: '+inspect(eventName));
        return false;
    }

    if (this.services[name].local)
        this.emit(GLOBAL_EVENT_NAME, eventName, data);
    else
        this.sendEventToAddr(this.services[name].addr, eventName, data);

    return true;
};

/**
 * Send event to either the local process or remote process.
 * @param {String} addr The address of the service to receive the message.
 * @param {String} eventName The event name to send.
 * @param {Object} [data] Optional user data to send with message.
 * @return {Boolean} true on success, false otherwise.
 * @private
 */
Discovery.prototype.sendEventToAddress = function(addr, eventName, data) {
    if (!is.nonEmptyStr(eventName)) {
        debug('Discovery.sendEventToAddress invalid event name: '+
                    inspect(eventName));
        return false;
    }

    if (!is.nonEmptyStr(addr)) {
        debug('Discovery.sendEventToAddress invalid addr: '+inspect(addr));
        return false;
    }

    var obj = {
        eventName: eventName,
        data: data
    };

    // convert data to JSON string
    var str = objToJson.jsonStringify(obj);
    if (!str) {
        debug('Discovery.sendEvent could not stringify data param: '+
              inspect(data));
        return false;
    }
    var buf = new Buffer(str);
    this.socket.send(buf, 0, buf.length, this.port, addr);

    return true;
};
