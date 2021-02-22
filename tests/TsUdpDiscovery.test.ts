import test from "ava";

const { UDP } = "../src/index.ts";

const service = {
  port: 80,
  proto: "tcp",
  annInterval: 1000,
  addrFamily: "IPv4",
  moreData: {
    name: "Edmond",
    day: 2233,
    week: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  },
};

let count = 0;

const getTsUdpDiscovery = (port: number = service.port, interval: number = service.annInterval) =>
  new UDP({ port, timeOutIntervalTime: interval });

test("should send a single initial event and then a time out", t => {
  const tsDiscovery = getTsUdpDiscovery();

  tsDiscovery.on("available", (name, data, reason) => {
    count += 1;
    t.is(count === 1, true);
    t.is(reason === "new", true);
  });

  tsDiscovery.on("unavailable", (name, data, reason) => {
    count += 1;
    t.is(count === 2, true);
    t.is(reason === "timedOut", true);
  });

  tsDiscovery.announce(service.moreData.name, service, 500, true);
  setTimeout(() => {
    tsDiscovery.pause(service.moreData.name);
  }, 500);
});

test("should remove the service from the table in less than 2100 ms", t => {
  const tsDiscovery = getTsUdpDiscovery();

  tsDiscovery.on("available", (name, data, reason) => {
    count += 1;
    t.is(count === 1, true);
    t.is(reason === "new", true);
  });

  tsDiscovery.on("unavailable", (name, data, reason) => {
    count += 1;

    t.is(count === 2, true);
    t.is(reason === "timedOut", true);
    t.is(typeof tsDiscovery.services !== "undefined", true);
    t.is(typeof tsDiscovery.services.test === "undefined", true);
  });

  tsDiscovery.announce(service.moreData.name, service, 500, true);
  tsDiscovery.pause(service.moreData.name);
});
