import { TRsInfoObject } from "src/types/messages";
import { IServiceObject } from "src/types/services";

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
