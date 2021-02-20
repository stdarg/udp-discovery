"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UDP = void 0;
/* global NodeJS */
const debug_1 = require("debug");
const dgram = __importStar(require("dgram"));
const events_1 = require("events");
const Logger = (...args) => debug_1.log(...args);
var dgramTypes;
(function (dgramTypes) {
    dgramTypes["UDP4"] = "udp4";
    dgramTypes["UDP6"] = "udp6";
})(dgramTypes || (dgramTypes = {}));
var availability;
(function (availability) {
    availability["Availabile"] = "availabile";
    availability["Unavailabile"] = "unavailabile";
})(availability || (availability = {}));
var defaultOptions;
(function (defaultOptions) {
    defaultOptions["MULTICAST_ADDRESS"] = "224.0.0.234";
    defaultOptions[defaultOptions["DEFAULT_UDP_PORT"] = 44201] = "DEFAULT_UDP_PORT";
    defaultOptions[defaultOptions["DEFAULT_TIMEOUT"] = 1000] = "DEFAULT_TIMEOUT";
    defaultOptions[defaultOptions["DEFAULT_INTERVAL"] = 3000] = "DEFAULT_INTERVAL";
    defaultOptions["GLOBAL_EVENT_NAME"] = "MessageBus";
})(defaultOptions || (defaultOptions = {}));
const isLibrary = {
    nonEmptyObj: (object) => Object.keys(object).length > 0,
    nonEmptyStr: (value) => typeof value === "string" && value !== "",
    nonEmptyArray: (value) => Array.isArray(value) && value.length > 0,
    isFunction: (value) => !!(value && value.constructor && value.call && value.apply),
};
const objToJson = {
    jsonParse: (value) => JSON.parse(value),
    copyObj: (value) => ({ ...value }),
    jsonStringify: (value) => JSON.stringify(value),
};
const createServiceObject = (name, interval, data, available, local, rinfo) => ({
    name,
    interval,
    data,
    available,
    local,
    address: rinfo && rinfo.address ? rinfo.address : undefined,
    lastAnnTm: Date.now(),
    intervalId: undefined,
});
const lockNameProperty = (name, service) => {
    Object.defineProperty(service, "name", {
        value: name,
        writable: false,
        enumerable: true,
        configurable: true,
    });
};
/**
 * Creates a Discovery object. The options object is optional. Supported
 * options are:
 *   - port - Set the port the service listens on for announcements default:
 *     44201
 *   - bindAddress - bind to an address
 *   - dgramType - Either 'udp4' or 'udp6', default: 'udp4'.
 *   - timeOutIntervalTime - duration of time between timeout checks in ms. Default 1000.
 * @param {TUDPServiceDiscoveryOptions} [options] An optional configuration object.
 * @constructor
 */
class UDP extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.reuseAddress = true;
        this.services = {};
        this.port = options.port || defaultOptions.DEFAULT_UDP_PORT;
        this.bindAddress = options.bindAddress;
        this.dgramType = options.type || dgramTypes.UDP4;
        this.timeOutIntervalTime = options.timeOutIntervalTime || defaultOptions.DEFAULT_TIMEOUT;
        this.socket = dgram.createSocket({
            type: this.dgramType,
            reuseAddr: this.reuseAddress,
        });
        this.socket.bind(this.port, this.bindAddress);
        this.timeOutId = setInterval(this.handleTimeOut, this.timeOutIntervalTime);
        // listen and listen for multicast packets
        this.socket.on("listening", () => {
            this.socket.addMembership(defaultOptions.MULTICAST_ADDRESS);
        });
        this.socket.on("message", (message, rinfo) => {
            if (message) {
                const obj = objToJson.jsonParse(message.toString());
                if (!obj) {
                    Logger(`[UDP on message] Error: JSON parse failed on ${message.toString()}`);
                    return;
                }
                // the received message was either an event or an announcement
                if (obj.eventName) {
                    this.emit(defaultOptions.GLOBAL_EVENT_NAME, obj.eventName, obj.data);
                }
                else {
                    this.handleAnnouncement(obj, rinfo);
                }
            }
        });
    }
    /**
     * Receives and processes announcements for a service.
     * @param {Object} ann The object describing the service.
     * @param {Object} [rinfo] An object with the sender's address information.
     * @return {Boolean} true, if successful false otherwise.
     * @private
     */
    handleAnnouncement(announcement, rinfo) {
        // ensure the ann is an object that is not empty
        if (!isLibrary.nonEmptyObj(announcement)) {
            Logger(`[UDP handleAnnouncement] Error: bad announcement ${announcement}`);
            return false;
        }
        // also, the ann obj needs a name
        if (!announcement.name) {
            Logger("[UDP handleAnnouncement] Error: name on announcement not present");
            return false;
        }
        // The entry exists, update it
        if (this.services && this.services[announcement.name]) {
            this.services[announcement.name].lastAnnTm = Date.now();
            return this.updateExisting(announcement.name, announcement.data, announcement.interval, announcement.available, rinfo);
        }
        // the entry is new, add it
        const announce = false;
        return this.addNewService(announcement.name, announcement.data, announcement.interval, announcement.available, announce, rinfo);
    }
    /**
     * update an existing service entry. Only works on services created locally.
     * @param {String} name The name of the service to announce. Required.
     * @param {Object} userData Any data the user desires, must be serializable to
     *      JSON. Required.
     * @param {Number} interval The duration between announcements. Default 3000 ms.
     * @param {Boolean} [available] OPtional parameter setting the state of the
     *      service. If not included, the default is true meaning available.
     * @param {TRsInfoObject} [rinfo] Optional parameter for remote address
     * @return {Boolean} true if successful, false otherwise.
     */
    updateExisting(name, userData, interval, available, rinfo) {
        // this is an existing entry
        const oldAvail = this.services[name].available;
        // update the lanst announcement time to now
        this.services[name].interval = interval;
        this.services[name].data = userData;
        // if there is an rinfo, copy it and place it on the service
        // we don't need the size parameter, though.
        if (rinfo && rinfo.address && !this.services[name].address) {
            this.services[name].address = rinfo.address;
        }
        // if the availability changed, send an event
        if (available !== oldAvail) {
            this.services[name].available = available;
            const evName = available ? availability.Availabile : availability.Unavailabile;
            this.emit(evName, name, this.services[name], "availabilityChange");
        }
        return true;
    }
    /**
     * Handle timeouts on announcements. Deletes timed out entries from services.
     * @private
     */
    handleTimeOut() {
        // Also the object should have a services storage on it
        if (!this.services || !Object.keys(this.services).length) {
            Logger("[UDP handleTimeOut] Error: no services, exiting.");
            return;
        }
        const now = Date.now();
        Object.keys(this.services).forEach(name => {
            if (now - this.services[name].lastAnnTm > 2 * this.services[name].interval) {
                this.emit(availability.Unavailabile, name, this.services[name], "timedOut");
            }
        });
    }
    /**
     * Send new event when service first created
     * @param {String} name The name of the service to announce. Required.
     * @param {IServiceObject} service Service to announce.
     * @param {Boolean} [available] Optional parameter setting the state of the
     *      service. If not included, the default is true meaning available.
     */
    sendNewEvent(name, service, available) {
        const evName = available ? availability.Availabile : availability.Unavailabile;
        this.emit(evName, name, service, "new");
    }
    /**
     * Send announcement of the event
     * @param {boolean} announce Should the service be continuouusly announced.
     * @param {IServiceObject} service Service to announce.
     * @return {NodeJS.Timeout | undefined} interval or undefined.
     */
    createIntervalAnnoumcement(interval, service) {
        const sendAnnouncement = () => {
            this.sendAnnounce(service);
        };
        return setInterval(sendAnnouncement, interval);
    }
    /**
     * Adds new announcements to the services object. Takes care of adding missing
     * values that have defaults, making the name property constant, and emitting
     * the correct events. If local is true, the service is local to this process.
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
    addNewService(name, userData, interval, available = true, announce, rinfo) {
        Logger("[UDP addNewService] Starting");
        if (!isLibrary.nonEmptyStr(name)) {
            Logger(`[UDP addNewService] -Name ${name} Error: invalid name`);
            return false;
        }
        if (!userData) {
            Logger(`[UDP addNewService] -Name ${name} Error: no user data`);
            return false;
        }
        const localInterval = interval > 0 ? interval : defaultOptions.DEFAULT_INTERVAL;
        if (this.services[name]) {
            Logger(`[UDP addNewService] -Name '${name} Error: Service allready exist`);
            return false;
        }
        const service = createServiceObject(name, localInterval, userData, available, announce, rinfo);
        lockNameProperty(name, service);
        this.services[name] = service;
        this.sendNewEvent(name, this.services[name], available);
        if (announce) {
            this.services[name].intervalId = this.createIntervalAnnoumcement(localInterval, this.services[name]);
        }
        return true;
    }
    /**
     * Setup to send announcements for a service over UDP multicast.
     * @param {IServiceObject} data The service to announce.
     * @return {Boolean} true, if successful false otherwise.
     * @private
     */
    sendAnnounce(data) {
        if (!isLibrary.nonEmptyObj(data)) {
            Logger(`[UDP sendAnnounce] Error: invalid data - ${data}`);
            return false;
        }
        const copy = objToJson.copyObj(data);
        copy.lastAnnTm = undefined;
        copy.intervalId = undefined;
        const str = objToJson.jsonStringify(copy);
        if (!str) {
            Logger(`[UDP sendAnnounce] Error: failed on stringify data: ${data}`);
            return false;
        }
        // send the stringified buffer over multicast
        const buf = Buffer.alloc(str.length, str);
        this.socket.send(buf, 0, buf.length, this.port, defaultOptions.MULTICAST_ADDRESS);
        return true;
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
    announce(name, userData, interval, available = true) {
        if (!isLibrary.nonEmptyStr(name)) {
            Logger(`[UDP announce] -Name ${name} Error: invalid name`);
            return false;
        }
        if (!userData) {
            Logger(`[UDP announce] -Name ${name} Error: no user data`);
            return false;
        }
        // add defaults, if needed
        const localInterval = interval > 0 ? interval : defaultOptions.DEFAULT_INTERVAL;
        // make a copy of the userData object
        const userDataCopy = objToJson.copyObj(userData);
        if (!userDataCopy) {
            return false;
        }
        Logger(`[UDP announce] -Name ${name} user data: ${JSON.stringify(userDataCopy)}`);
        // attempt to add the announcement return result to user
        const announce = true;
        return this.addNewService(name, userDataCopy, localInterval, available, announce);
    }
    /**
     * Pause announcements for a service.
     * @param {String} name The name of the service to resume announcements.
     * @return {Boolean} true, if successful false otherwise.
     */
    pause(name) {
        // we have to have a name that is string and not empty
        if (!isLibrary.nonEmptyStr(name)) {
            Logger(`[UDP pause] -Name ${name} Error: invalid name`);
            return false;
        }
        if (!isLibrary.nonEmptyObj(this.services)) {
            Logger(`[UDP pause] -Name ${name} Error: There are no services to stop`);
            return false;
        }
        // the service has to be already known to stop announcing
        if (!this.services[name]) {
            Logger(`[UDP pause] -Name ${name} Error: no such service`);
            return false;
        }
        // if there is no task to do the announcing, quit
        if (!this.services[name].intervalId) {
            Logger(`[UDP pause] -Name ${name} Error: no entry for service`);
            return false;
        }
        // clear the interval and remove the intervalId property
        clearInterval(this.services[name].intervalId);
        this.services[name].intervalId = undefined;
        return true;
    }
    /**
     * Resumes announcements for a service.
     * @param {String} name The name of the service to resume announcements.
     * @param {Number} [interval] The duration in ms between announcements.
     *      Optional.
     * @return {Boolean} true, if successful false otherwise.
     */
    resume(name, interval) {
        // we need a name that is a string which is not empty
        if (!isLibrary.nonEmptyStr(name)) {
            Logger(`[UDP resume] -Name ${name} Error: invalid name`);
            return false;
        }
        // the service has to be known to resume
        if (!this.services || !this.services[name]) {
            Logger(`[UDP resume] -Name ${name} Error: no such service`);
            return false;
        }
        this.services[name].interval = interval > 0 ? interval : defaultOptions.DEFAULT_INTERVAL;
        // there can't be an interval task doing announcing to resume
        if (this.services[name].intervalId) {
            Logger(`[UDP resume] -Name ${name} Error: already announcing`);
            return false;
        }
        // create a function to send the announcement using the closure to retain
        // the name and self
        const sendAnnouncement = () => {
            this.sendAnnounce(this.services[name]);
        };
        // create an interval task and store the id on the service entry
        this.services[name].intervalId = setInterval(sendAnnouncement, this.services[name].interval);
        return true;
    }
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
    update(name, userData, interval, available = true) {
        // we have to have a name that is string and not empty
        if (!isLibrary.nonEmptyStr(name)) {
            Logger(`[UDP update] -Name ${name} Error: invalid name`);
            return false;
        }
        if (!userData) {
            Logger(`[UDP update] -Name ${name} Error: no user data`);
            return false;
        }
        const localInterval = interval > 0 ? interval : defaultOptions.DEFAULT_INTERVAL;
        // make a copy of the userData object
        const userDataCopy = objToJson.copyObj(userData);
        if (!userDataCopy) {
            return false;
        }
        // attempt to add the announcement return result to user
        return this.updateExisting(name, userDataCopy, localInterval, available);
    }
    /**
     * Retrieves service information by name.
     * @param {String} name The name of the service for which you want data.
     * @return {Object|Boolean} The object describing the srevice if available, and
     *     false otherwise.
     */
    getData(name) {
        // handle conditions for which there is no answer
        if (!isLibrary.nonEmptyStr(name)) {
            return false;
        }
        if (!this.services || !this.services[name]) {
            return false;
        }
        // Developers just want annoucement data, send that.
        return this.services[name].data;
    }
    /**
     * Send an event to all discovered services.
     * @param {String} eventName The name of the event.
     * @param {Object} [userData] User data sent along with the event. Optional.
     * @return {Boolean} true, if successful false otherwise.
     */
    sendEvent(eventName, userData) {
        if (!isLibrary.nonEmptyStr(eventName)) {
            Logger(`[UDP update] -Event Name ${eventName} Error: invalid event name`);
            return false;
        }
        return this.sendEventToAddress(defaultOptions.MULTICAST_ADDRESS, eventName, userData);
    }
    /**
     * Send an event to a service, an array of services, or services matching a
     * query.
     * @param {String|Array|Function} destinationServices The service name, an array of services
     *      or a query to select services.
     * @param {String} eventName The name of the event.
     * @param {Object} [data] User data sent along with the event. Optional.
     * @return {Boolean} true on success, false otherwise.
     */
    sendEventTo(destinationServices, eventName, data) {
        if (!isLibrary.nonEmptyStr(destinationServices) &&
            !isLibrary.nonEmptyArray(destinationServices) &&
            !isLibrary.isFunction(destinationServices)) {
            Logger(`[UDP sendEventTo] -Event Name ${eventName} Error: invalid destination service`);
            return false;
        }
        if (!isLibrary.nonEmptyStr(eventName)) {
            Logger(`[UDP sendEventTo] -Event Name ${eventName} Error: invalid event name`);
            return false;
        }
        // handle the case where dest is a service name
        if (isLibrary.nonEmptyStr(destinationServices)) {
            this.sendEventToService(destinationServices, eventName, data);
        }
        else if (isLibrary.nonEmptyArray(destinationServices)) {
            const queryArray = destinationServices;
            queryArray.forEach(query => this.sendEventToService(query, eventName, data));
        }
        else if (isLibrary.isFunction(destinationServices)) {
            const queryFunc = destinationServices;
            Object.keys(this.services).forEach(name => {
                if (queryFunc(this.services[name]) === true) {
                    this.sendEventToService(this.services[name].name, eventName, data);
                }
            });
        }
        return true;
    }
    /**
     * Send event to either the local process or remote process.
     * @param {String} name The name of the service to receive the message.
     * @param {String} eventName The name of the event.
     * @param {Object} [data] Optional user data to send with message.
     * @return {Boolean} true on success, false otherwise.
     * @private
     */
    sendEventToService(name, eventName, data) {
        if (!isLibrary.nonEmptyStr(name)) {
            Logger(`[UDP sendEventToService] -Name ${name} Error: invalid name`);
            return false;
        }
        if (!this.services[name]) {
            Logger(`[UDP sendEventToService] -Name ${name} Error: no such service`);
            return false;
        }
        if (!isLibrary.nonEmptyStr(eventName)) {
            Logger(`[UDP sendEventToService] -Name ${name} Error: invalid event name`);
            return false;
        }
        if (this.services[name].local) {
            this.emit(defaultOptions.GLOBAL_EVENT_NAME, eventName, data);
        }
        else if (this.services[name].address) {
            this.sendEventToAddress(this.services[name].address, eventName, data);
        }
        return true;
    }
    /**
     * Send event to either the local process or remote process.
     * @param {String} address The address of the service to receive the message.
     * @param {String} eventName The event name to send.
     * @param {Object} [data] Optional user data to send with message.
     * @return {Boolean} true on success, false otherwise.
     * @private
     */
    sendEventToAddress(address, eventName, data) {
        if (!isLibrary.nonEmptyStr(eventName)) {
            Logger(`[UDP sendEventToAddress] -Event Name ${eventName} Error: invalid event name`);
            return false;
        }
        if (!isLibrary.nonEmptyStr(address)) {
            Logger(`[UDP sendEventToAddress] -Event Name ${eventName} Error: invalid address`);
            return false;
        }
        const obj = {
            eventName,
            data,
        };
        // convert data to JSON string
        const str = objToJson.jsonStringify(obj);
        if (!str) {
            Logger(`[UDP sendEventToAddress] -Event Name ${eventName} Error: JSON stringify data paramenter`);
            return false;
        }
        const buf = Buffer.alloc(str.length, str);
        this.socket.send(buf, 0, buf.length, this.port, address);
        return true;
    }
}
exports.UDP = UDP;
//# sourceMappingURL=index.js.map