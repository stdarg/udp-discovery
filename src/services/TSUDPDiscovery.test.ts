import test from "ava";

import { EEventNames, EEventReasons } from "../enums/events";
import { TSUDPDiscovery } from "./TSUDPDiscovery";

const service = {
  port: 80,
  proto: "tcp",
  annInterval: 1000,
  addrFamily: "IPv4",
  data: {
    name: "Edmond",
    day: 2233,
    week: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  },
};

const getTSUDPDiscovery = (port: number = service.port, interval: number = service.annInterval) =>
  new TSUDPDiscovery({ port, timeOutIntervalTime: interval });

test("should send a single initial event and then a time out", async t => {
  const tsDiscovery = getTSUDPDiscovery();

  await new Promise(resolve => {
    tsDiscovery.on(EEventNames.Available, (name, data, reason: EEventReasons) => {
      t.is(reason === EEventReasons.New, true);
    });

    tsDiscovery.on(EEventNames.Unavailable, (name, data, reason: EEventReasons) => {
      t.is(reason === EEventReasons.TimedOut, true);
      resolve(true);
    });

    tsDiscovery.announce(service.data.name, service, 500, true);
    setTimeout(() => {
      tsDiscovery.pause(service.data.name);
    }, 500);
  });

  t.plan(2);
});

test("should remove the service inteval from service", async t => {
  const tsDiscovery = getTSUDPDiscovery();

  await new Promise(resolve => {
    tsDiscovery.on(EEventNames.Available, (name, data, reason: EEventReasons) => {
      t.is(reason === EEventReasons.New, true);
    });

    tsDiscovery.on(EEventNames.Unavailable, (name, data, reason: EEventReasons) => {
      t.is(reason === EEventReasons.TimedOut, true);
      t.is(typeof tsDiscovery.services !== "undefined", true);
      t.is(typeof tsDiscovery.services[service.data.name].intervalId === "undefined", true);
      resolve(true);
    });

    tsDiscovery.announce(service.data.name, service, 500, true);
    tsDiscovery.pause(service.data.name);
  });

  t.plan(4);
});
