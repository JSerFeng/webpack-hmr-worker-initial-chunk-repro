const { parentPort } = require("node:worker_threads");
require("./page");
parentPort.postMessage({ ready: true, value: globalThis.value });
parentPort.on("message", async () => {
  try {
    const updated = await module.hot.check(true);
    parentPort.postMessage({ updated, value: globalThis.value, status: module.hot.status() });
  } catch (error) {
    parentPort.postMessage({ error: error.message, value: globalThis.value, status: module.hot.status() });
  }
});
