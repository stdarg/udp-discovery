export enum EEventNames {
  MessageBus = "MessageBus",
  Available = "available",
  Unavailable = "unavailable",
}

export enum ESocketEvents {
  Listening = "listening",
  Message = "message",
}

export enum EEventReasons {
  New = "new",
  TimedOut = "timedOut",
  AvailabilityChange = "availabilityChange",
}
