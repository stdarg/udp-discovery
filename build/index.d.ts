/// <reference types="node" />
import * as dgram from "dgram";
import { EventEmitter } from "events";
declare enum dgramTypes {
    UDP4 = "udp4",
    UDP6 = "udp6"
}
declare type TAnnouncementObject = {
    name: string;
    data: {
        [key: string]: any;
    };
    interval: number;
    available: boolean;
    eventName?: string;
};
declare type TRsInfoObject = {
    address?: string;
};
declare type TUDPServiceDiscoveryOptions = {
    port: number;
    timeOutIntervalTime: number;
    type?: dgramTypes;
    bindAddress?: string;
};
interface IService {
    name: string;
    interval: number;
    data: {
        [key: string]: any;
    };
    available: boolean;
    address?: string;
    local?: boolean;
}
interface IServiceObject extends IService {
    lastAnnTm: number;
    intervalId: NodeJS.Timeout | undefined;
}
interface UDPInterface {
    dgramType: dgramTypes;
    port: number;
    socket: dgram.Socket;
    bindAddress: string | undefined;
    timeOutId: NodeJS.Timeout | null;
}
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
export declare class UDP extends EventEmitter implements UDPInterface {
    private reuseAddress;
    private timeOutIntervalTime;
    private services;
    dgramType: dgramTypes;
    socket: dgram.Socket;
    port: number;
    bindAddress: string | undefined;
    timeOutId: NodeJS.Timeout;
    constructor(options: TUDPServiceDiscoveryOptions);
    /**
     * Receives and processes announcements for a service.
     * @param {Object} ann The object describing the service.
     * @param {Object} [rinfo] An object with the sender's address information.
     * @return {Boolean} true, if successful false otherwise.
     * @private
     */
    handleAnnouncement(announcement: TAnnouncementObject, rinfo: TRsInfoObject): boolean;
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
    updateExisting(name: string, userData: {
        [key: string]: any;
    }, interval: number, available: boolean, rinfo?: TRsInfoObject): boolean;
    /**
     * Handle timeouts on announcements. Deletes timed out entries from services.
     * @private
     */
    handleTimeOut(): void;
    /**
     * Send new event when service first created
     * @param {String} name The name of the service to announce. Required.
     * @param {IServiceObject} service Service to announce.
     * @param {Boolean} [available] Optional parameter setting the state of the
     *      service. If not included, the default is true meaning available.
     */
    sendNewEvent(name: string, service: IServiceObject, available?: boolean): void;
    /**
     * Send announcement of the event
     * @param {boolean} announce Should the service be continuouusly announced.
     * @param {IServiceObject} service Service to announce.
     * @return {NodeJS.Timeout | undefined} interval or undefined.
     */
    createIntervalAnnoumcement(interval: number, service: IServiceObject): NodeJS.Timeout;
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
    addNewService(name: string, userData: {
        [key: string]: any;
    }, interval: number, available?: boolean, announce?: boolean, rinfo?: TRsInfoObject): boolean;
    /**
     * Setup to send announcements for a service over UDP multicast.
     * @param {IServiceObject} data The service to announce.
     * @return {Boolean} true, if successful false otherwise.
     * @private
     */
    sendAnnounce(data: IServiceObject): boolean;
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
    announce(name: string, userData: {
        [key: string]: any;
    }, interval: number, available?: boolean): boolean;
    /**
     * Pause announcements for a service.
     * @param {String} name The name of the service to resume announcements.
     * @return {Boolean} true, if successful false otherwise.
     */
    pause(name: string): boolean;
    /**
     * Resumes announcements for a service.
     * @param {String} name The name of the service to resume announcements.
     * @param {Number} [interval] The duration in ms between announcements.
     *      Optional.
     * @return {Boolean} true, if successful false otherwise.
     */
    resume(name: string, interval: number): boolean;
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
    update(name: string, userData: {
        [key: string]: any;
    }, interval: number, available?: boolean): boolean;
    /**
     * Retrieves service information by name.
     * @param {String} name The name of the service for which you want data.
     * @return {Object|Boolean} The object describing the srevice if available, and
     *     false otherwise.
     */
    getData(name: string): object | boolean;
    /**
     * Send an event to all discovered services.
     * @param {String} eventName The name of the event.
     * @param {Object} [userData] User data sent along with the event. Optional.
     * @return {Boolean} true, if successful false otherwise.
     */
    sendEvent(eventName: string, userData: {
        [key: string]: any;
    }): boolean;
    /**
     * Send an event to a service, an array of services, or services matching a
     * query.
     * @param {String|Array|Function} destinationServices The service name, an array of services
     *      or a query to select services.
     * @param {String} eventName The name of the event.
     * @param {Object} [data] User data sent along with the event. Optional.
     * @return {Boolean} true on success, false otherwise.
     */
    sendEventTo(destinationServices: string | Array<string> | Function, eventName: string, data?: object): boolean;
    /**
     * Send event to either the local process or remote process.
     * @param {String} name The name of the service to receive the message.
     * @param {String} eventName The name of the event.
     * @param {Object} [data] Optional user data to send with message.
     * @return {Boolean} true on success, false otherwise.
     * @private
     */
    sendEventToService(name: string, eventName: string, data?: object): boolean;
    /**
     * Send event to either the local process or remote process.
     * @param {String} address The address of the service to receive the message.
     * @param {String} eventName The event name to send.
     * @param {Object} [data] Optional user data to send with message.
     * @return {Boolean} true on success, false otherwise.
     * @private
     */
    sendEventToAddress(address: string, eventName: string, data?: object): boolean;
}
export {};
//# sourceMappingURL=index.d.ts.map