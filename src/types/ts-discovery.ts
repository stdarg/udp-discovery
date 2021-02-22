/* global NodeJS */
import * as dgram from "dgram";
import { EventEmitter } from "events";

import { EDgramTypes } from "../enums/dgram";
import { IServiceObject } from "./services";

export interface ITSUDPDiscovery {
  dgramType: EDgramTypes;
  services: { [key: string]: IServiceObject };
  port: number;
  socket: dgram.Socket;
  bindAddress: string | undefined;
  timeOutId: NodeJS.Timeout | null;
  on: (eventName: string, callback: (...args: any[]) => void) => EventEmitter;
  emit: (eventName: string, name: string, ...args: any[]) => boolean;
}
