/* global NodeJS */
import * as dgram from "dgram";

import { dgramTypes } from "./enums";

export type TAnnouncementObject = {
  name: string;
  data: { [key: string]: any };
  interval: number;
  available: boolean;
  eventName?: string;
};

export type TRsInfoObject = {
  address?: string;
};

export type TUDPServiceDiscoveryOptions = {
  port: number;
  timeOutIntervalTime: number;
  type?: dgramTypes;
  bindAddress?: string;
};

export interface IService {
  name: string;
  interval: number;
  data: { [key: string]: any };
  available: boolean;
  address?: string;
  local?: boolean;
}

export interface IServiceObject extends IService {
  lastAnnTm: number;
  intervalId: NodeJS.Timeout | undefined;
}

export interface IServiceAnnouncement extends IService {
  lastAnnTm?: number;
  intervalId?: NodeJS.Timeout;
}

export interface UDPInterface {
  dgramType: dgramTypes;
  port: number;
  socket: dgram.Socket;
  bindAddress: string | undefined;
  timeOutId: NodeJS.Timeout | null;
}
