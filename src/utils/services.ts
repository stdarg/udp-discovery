import { IServiceObject, TRsInfoObject } from "src/types";

export const createServiceObject = (
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
