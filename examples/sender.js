const Discovery = require("../build/index.js").UDP;

const discover = new Discovery();

const name = "test";
const interval = 500;
const available = true;

const serv = {
  port: 80,
  proto: "tcp",
  addrFamily: "IPv4",
  bonus: {
    name: "Edmond",
    day: 2233,
    week: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  },
};

discover.announce(name, serv, interval, available);

discover.on("MessageBus", function (event, data) {
  console.log("event:", event);
  console.log("data:", data);
});
