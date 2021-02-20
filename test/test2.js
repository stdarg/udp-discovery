const assert = require("assert");
const { UDP } = require("../build/index.js");

const service = {
  annInterval: 500,
  port: 80,
  proto: "tcp",
  addrFamily: "IPv4",
  userData: {
    name: "Edmond",
    day: 2233,
    week: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  },
};

const discover = new UDP({ port: service.port, timeOutIntervalTime: service.annInterval });

let count = 0;

describe("udp-discovery", () => {
  it("should remove the service from the table in less than 2100 ms", done => {
    discover.on("available", (name, data, reason) => {
      count += 1;
      assert.ok(count === 1);
      assert.ok(reason === "new");
    });

    discover.on("unavailable", (name, data, reason) => {
      count += 1;
      assert.ok(count === 2);

      assert.ok(reason === "timedOut");
      assert.ok(typeof discover.services !== "undefined");

      assert.ok(typeof discover.services.test === "undefined");
      done();
    });

    discover.announce(service.moreData.name, service, 500, true);
    discover.pause(service.moreData.name);
  });
});
