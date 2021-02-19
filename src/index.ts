/* global NodeJS */
import { log } from "debug";
import * as dgram from "dgram";
import { EventEmitter } from "events";
import * as util from "util";

const { inspect } = util;
const Logger = (...args: Array<any>) => log(...args);

enum dgramTypes {
  UDP4 = "udp4",
  UDP6 = "udp6",
}

enum availability {
  Availabile = "availabile",
  Unavailabile = "unavailabile",
}

enum defaultOptions {
  MULTICAST_ADDRESS = "224.0.0.234",
  DEFAULT_UDP_PORT = 44201,
  DEFAULT_TIMEOUT = 1000,
  DEFAULT_INTERVAL = 3000,
  GLOBAL_EVENT_NAME = "MessageBus",
}

type TAnnouncementObject = {
  name: string;
  data: { [key: string]: any };
  interval: number;
  available: boolean;
  eventName?: string;
};

type TRsInfoObject = {
  address?: string;
};

type TUDPServiceDiscoveryOptions = {
  port: number;
  timeOutIntervalTime: number;
  type?: dgramTypes;
  bindAddress?: string;
};

interface IService {
  name: string;
  interval: number;
  data: { [key: string]: any };
  available: boolean;
  address?: string;
  local?: boolean;
}

interface IServiceObject extends IService {
  lastAnnTm: number;
  intervalId: NodeJS.Timeout | undefined;
}

interface IServiceAnnouncement extends IService {
  lastAnnTm?: number;
  intervalId?: NodeJS.Timeout;
}

interface UDPInterface {
  dgramType: dgramTypes;
  port: number;
  socket: dgram.Socket;
  bindAddress: string | undefined;
  timeOutId: NodeJS.Timeout | null;
}

const isLibrary = {
  nonEmptyObj: (object: object) => Object.keys(object).length > 0,
  nonEmptyStr: (value: any): boolean => typeof value === "string" && value !== "",
  nonEmptyArray: (value: any): boolean => Array.isArray(value) && value.length > 0,
  isFunction: (value: any): boolean => !!(value && value.constructor && value.call && value.apply),
};

const objToJson = {
  jsonParse: <T>(value: string): T | undefined => JSON.parse(value),
  copyObj: <T>(value: T): T => ({ ...value }),
  jsonStringify: (value: object): string => JSON.stringify(value),
};

const createServiceObject = (
  name: string,
  interval: number,
  data: {
    [key: string]: any;
  },
  available: boolean,
  local: boolean | undefined,
  rinfo: TRsInfoObject | undefined
): IServiceObject => ({
  name,
  interval,
  data,
  available,
  local,
  address: rinfo && rinfo.address ? rinfo.address : undefined,
  lastAnnTm: Date.now(),
  intervalId: undefined,
});

const lockNameProperty = (name: string, service: IServiceObject): void => {
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
export class UDP extends EventEmitter implements UDPInterface {
  private reuseAddress: boolean = true;
  private timeOutIntervalTime: number;
  private services: { [key: string]: IServiceObject };
  dgramType;
  socket;
  port;
  bindAddress;
  timeOutId;

  constructor(options: TUDPServiceDiscoveryOptions) {
    super();
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

    this.timeOutId = setInterval(() => {
      this.handleTimeOut();
    }, this.timeOutIntervalTime);

    // listen and listen for multicast packets
    this.socket.on("listening", () => {
      this.socket.addMembership(defaultOptions.MULTICAST_ADDRESS);
    });

    this.socket.on("message", (message, rinfo) => {
      if (message) {
        const obj = <TAnnouncementObject>objToJson.jsonParse(message.toString());

        if (!obj) {
          Logger(`bad announcement: ${message.toString()}`);

          return;
        }

        // the received message was either an event or an announcement
        if (obj.eventName) {
          this.emit(defaultOptions.GLOBAL_EVENT_NAME, obj.eventName, obj.data);
        } else {
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
  handleAnnouncement(ann: TAnnouncementObject, rinfo: TRsInfoObject): boolean {
    // ensure the ann is an object that is not empty
    if (!isLibrary.nonEmptyObj(ann)) {
      Logger(`handleAnnouncement bad ann: ${inspect(ann)}`);

      return false;
    }

    // also, the ann obj needs a name
    if (!ann.name) {
      Logger("handleAnnouncement error: no name.");

      return false;
    }

    // The entry exists, update it
    if (this.services && this.services[ann.name]) {
      this.services[ann.name].lastAnnTm = Date.now();

      return this.updateExisting(ann.name, ann.data, ann.interval, ann.available, rinfo);
    }

    // the entry is new, add it
    const announce = false;

    return this.addNew(ann.name, ann.data, ann.interval, ann.available, announce, rinfo);
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
  updateExisting(
    name: string,
    userData: { [key: string]: any },
    interval: number,
    available: boolean,
    rinfo?: TRsInfoObject
  ): boolean {
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
      Logger("handleTimeOut no services, exiting.");

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
  sendNewEvent(name: string, service: IServiceObject, available?: boolean) {
    const evName = available ? availability.Availabile : availability.Unavailabile;
    this.emit(evName, name, service, "new");
  }

  /**
   * Send announcement of the event
   * @param {boolean} announce Should the service be continuouusly announced.
   * @param {IServiceObject} service Service to announce.
   * @return {NodeJS.Timeout | undefined} interval or undefined.
   */
  createIntervalAnnoumcement(interval: number, service: IServiceObject): NodeJS.Timeout {
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
  addNew(
    name: string,
    userData: { [key: string]: any },
    interval: number,
    available: boolean = true,
    announce?: boolean,
    rinfo?: TRsInfoObject
  ): boolean {
    Logger("addNew");

    if (!isLibrary.nonEmptyStr(name)) {
      Logger(`addNew error: missing name: ${inspect(name)}`);

      return false;
    }

    if (!userData) {
      Logger("addNew error: no userData: what is being announced?");

      return false;
    }

    const localInterval = interval > 0 ? interval : defaultOptions.DEFAULT_INTERVAL;

    if (this.services[name]) {
      Logger(`addNew for '${name}', but it already exists.`);

      return false;
    }

    const service = createServiceObject(name, localInterval, userData, available, announce, rinfo);

    lockNameProperty(name, service);
    this.services[name] = service;

    this.sendNewEvent(name, this.services[name], available);

    if (announce) {
      this.services[name].intervalId = this.createIntervalAnnoumcement(
        localInterval,
        this.services[name]
      );
    }

    return true;
  }

  /**
   * Setup to send announcements for a service over UDP multicast.
   * @param {IServiceObject} data The service to announce.
   * @return {Boolean} true, if successful false otherwise.
   * @private
   */
  sendAnnounce(data: IServiceObject): boolean {
    if (!isLibrary.nonEmptyObj(data)) {
      Logger(`sendAnnounce has a bad param for data: ${inspect(data)}`);

      return false;
    }

    const copy = <IServiceAnnouncement>objToJson.copyObj(data);
    copy.lastAnnTm = undefined;
    copy.intervalId = undefined;

    const str = objToJson.jsonStringify(copy);

    if (!str) {
      Logger(`objToJson.jsonStringify failed on serice data: ${inspect(data)}`);

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
  announce(
    name: string,
    userData: { [key: string]: any },
    interval: number,
    available: boolean = true
  ): boolean {
    if (!isLibrary.nonEmptyStr(name)) {
      Logger(`accounce error: bad name: ${inspect(name)}`);

      return false;
    }

    if (!userData) {
      Logger("announce error: no userData: what is being announced?");

      return false;
    }

    // add defaults, if needed
    const localInterval = interval > 0 ? interval : defaultOptions.DEFAULT_INTERVAL;

    // make a copy of the userData object
    const userDataCopy = <object>objToJson.copyObj(userData);

    if (!userDataCopy) {
      return false;
    }

    Logger(`userDataCopy:${inspect(userDataCopy)}`);

    // attempt to add the announcement return result to user
    const announce = true;

    return this.addNew(name, userDataCopy, localInterval, available, announce);
  }

  /**
   * Pause announcements for a service.
   * @param {String} name The name of the service to resume announcements.
   * @return {Boolean} true, if successful false otherwise.
   */
  pause(name: string): boolean {
    // we have to have a name that is string and not empty
    if (!isLibrary.nonEmptyStr(name)) {
      Logger(`stopAnouncement: bad name param: ${inspect(name)}`);

      return false;
    }

    if (!isLibrary.nonEmptyObj(this.services)) {
      Logger("stopAnnounce: There are no services to stop");

      return false;
    }

    // the service has to be already known to stop announcing
    if (!this.services[name]) {
      Logger(`Discovery.stopAnnounce error: no entry for '${name}'`);

      return false;
    }

    // if there is no task to do the announcing, quit
    if (!this.services[name].intervalId) {
      Logger(`Discovery.stopAnnounce error: not announcing '${name}'`);

      return false;
    }

    // clear the interval and remove the intervalId property
    clearInterval(this.services[name].intervalId as NodeJS.Timeout);
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
  resume(name: string, interval: number): boolean {
    // we need a name that is a string which is not empty
    if (!isLibrary.nonEmptyStr(name)) {
      Logger(`Discovery.resumeAnnounce error: invalid name: ${inspect(name)}`);

      return false;
    }

    // the service has to be known to resume
    if (!this.services || !this.services[name]) {
      Logger(`resumeAnnounce error: no entry for '${name}'`);

      return false;
    }

    this.services[name].interval = interval > 0 ? interval : defaultOptions.DEFAULT_INTERVAL;

    // there can't be an interval task doing announcing to resume
    if (this.services[name].intervalId) {
      Logger(`resumeAnnounce error: already announcing '${name}'`);

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
  update(
    name: string,
    userData: { [key: string]: any },
    interval: number,
    available: boolean = true
  ): boolean {
    // we have to have a name that is string and not empty
    if (!isLibrary.nonEmptyStr(name)) {
      Logger(`update error: missing name: ${inspect(name)}`);

      return false;
    }

    if (!userData) {
      Logger("update error: no userData: what is being announced?");

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
  getData(name: string): object | boolean {
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
  sendEvent(eventName: string, userData: { [key: string]: any }): boolean {
    if (!isLibrary.nonEmptyStr(eventName)) {
      Logger(`sendEvent has a bad param for eventName: ${inspect(eventName)}`);

      return false;
    }

    return this.sendEventToAddress(defaultOptions.MULTICAST_ADDRESS, eventName, userData);
  }

  /**
   * Send an event to a service, an array of services, or services matching a
   * query.
   * @param {String|Array|Function} dest The service name, an array of services
   *      or a query to select services.
   * @param {String} eventName The name of the event.
   * @param {Object} [data] User data sent along with the event. Optional.
   * @return {Boolean} true on success, false otherwise.
   */
  sendEventTo(dest: string | Array<string> | Function, eventName: string, data?: object): boolean {
    if (
      !isLibrary.nonEmptyStr(dest) &&
      !isLibrary.nonEmptyArray(dest) &&
      !isLibrary.isFunction(dest)
    ) {
      Logger(`Discovery.sendEventTo received bad dest parameter: ${inspect(dest)}`);

      return false;
    }

    if (!isLibrary.nonEmptyStr(eventName)) {
      Logger(`Discovery.sendEventTo received bad name parameter: ${inspect(eventName)}`);

      return false;
    }

    // handle the case where dest is a service name
    if (isLibrary.nonEmptyStr(dest)) {
      this.sendEventToService(dest as string, eventName, data);
    } else if (isLibrary.nonEmptyArray(dest)) {
      const queryArray = dest as Array<string>;
      queryArray.forEach(query => this.sendEventToService(query, eventName, data));
    } else if (isLibrary.isFunction(dest)) {
      const queryFunc = dest as Function;
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
  sendEventToService(name: string, eventName: string, data?: object): boolean {
    if (!isLibrary.nonEmptyStr(name)) {
      Logger(`Discovery.sendEvent received bad name parameter: ${inspect(name)}`);

      return false;
    }

    if (!this.services[name]) {
      Logger(`Discovery.sendEvent no such service name as: ${inspect(name)}`);

      return false;
    }

    if (!isLibrary.nonEmptyStr(eventName)) {
      Logger(`Discovery.sendEvent invalid event name: ${inspect(eventName)}`);

      return false;
    }

    if (this.services[name].local) {
      this.emit(defaultOptions.GLOBAL_EVENT_NAME, eventName, data);
    } else if (this.services[name].address) {
      this.sendEventToAddress(this.services[name].address as string, eventName, data);
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
  sendEventToAddress(address: string, eventName: string, data?: object): boolean {
    if (!isLibrary.nonEmptyStr(eventName)) {
      Logger(`Discovery.sendEventToAddress invalid event name: ${inspect(eventName)}`);

      return false;
    }

    if (!isLibrary.nonEmptyStr(address)) {
      Logger(`Discovery.sendEventToAddress invalid addr: ${inspect(address)}`);

      return false;
    }

    const obj = {
      eventName,
      data,
    };

    // convert data to JSON string
    const str = objToJson.jsonStringify(obj);

    if (!str) {
      Logger(`Discovery.sendEvent could not stringify data param: ${inspect(data)}`);

      return false;
    }

    const buf = Buffer.alloc(str.length, str);
    this.socket.send(buf, 0, buf.length, this.port, address);

    return true;
  }
}
