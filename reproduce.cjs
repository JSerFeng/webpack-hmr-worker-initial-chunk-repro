const assert = require("node:assert/strict");
const { once } = require("node:events");
const { setup } = require("./harness.cjs");
const config = require("./webpack.config.cjs");
const control = process.argv.includes("--control");
if (control) config.optimization.splitChunks = false;
const h = setup(config);

(async () => {
  try {
    await h.start();
    const worker = app.worker;
    try {
      const [initial] = await once(worker, "message");
      assert.equal(initial.value, 1);
      h.edit(1); await h.compile("worker page acquires split dep");
      const response = once(worker, "message");
      worker.postMessage("update");
      const [update] = await response;
      h.save({ control, initial, update, expected: 2 });
      assert.equal(update.error, undefined);
      assert.equal(update.value, 2);
    } finally { await worker.terminate(); }
  } finally { await h.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
