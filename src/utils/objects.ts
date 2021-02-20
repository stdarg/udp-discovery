import { IServiceObject } from "src/types";

export const objToJson = {
  jsonParse: <T>(value: string): T | undefined => JSON.parse(value),
  copyObj: <T>(value: T): T => ({ ...value }),
  jsonStringify: (value: object): string => JSON.stringify(value),
};

export const lockNameProperty = (name: string, service: IServiceObject): void => {
  Object.defineProperty(service, "name", {
    value: name,
    writable: false,
    enumerable: true,
    configurable: true,
  });
};
