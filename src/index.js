globalThis.app ||= {};
app.hot = module.hot;
app.hash = () => __webpack_hash__;
app.worker = new Worker(new URL('./worker.js', import.meta.url));
module.hot.accept();
