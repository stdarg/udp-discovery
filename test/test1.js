const assert = require("assert");
const { UDP } = require("../build/index.js");

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

const discover = new UDP({ port: service.port, timeOutIntervalTime: service.annInterval });

let count = 0;

describe("udp-discovery", () => {
  it("should send a single initial event and then a time out", done => {
    discover.on("available", (name, data, reason) => {
      count += 1;
      assert.ok(count === 1);
      assert.ok(reason === "new");
    });

    discover.on("unavailable", (name, data, reason) => {
      count += 1;
      assert.ok(count === 2);
      assert.ok(reason === "timedOut");
      done();
    });

    discover.announce(service.moreData.name, service, 500, true);
    setTimeout(() => {
      discover.pause(service.moreData.name);
    }, 500);
  });
});
