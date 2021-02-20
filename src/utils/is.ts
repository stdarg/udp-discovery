export const isLibrary = {
  nonEmptyObj: (object: object) => Object.keys(object).length > 0,
  nonEmptyStr: (value: any): boolean => typeof value === "string" && value !== "",
  nonEmptyArray: (value: any): boolean => Array.isArray(value) && value.length > 0,
  isFunction: (value: any): boolean => !!(value && value.constructor && value.call && value.apply),
};
