const fs = require("node:fs");
const path = require("node:path");
const webpack = require(process.env.WEBPACK_PATH || "webpack");

exports.setup = function setup(config) {
  const root = __dirname;
  const work = path.join(root, ".work");
  fs.rmSync(work, { recursive: true, force: true });
  fs.cpSync(path.join(root, "src"), path.join(work, "src"), { recursive: true });
  const output = path.join(work, "dist");
  const compiler = webpack({
    mode: "development",
    target: "async-node",
    cache: false,
    devtool: false,
    entry: "./index.js",
    plugins: [new webpack.HotModuleReplacementPlugin()],
    ...config,
    context: path.join(work, "src"),
    recordsPath: path.join(work, "records.json"),
    output: {
      path: output,
      filename: "[name].js",
      chunkFilename: "[name].js",
      publicPath: "",
      uniqueName: require("./package.json").name,
      ...config.output,
    },
  });
  const builds = [];
  const compile = label => new Promise((resolve, reject) => {
    compiler.inputFileSystem.purge();
    compiler.run((error, stats) => {
      if (error) return reject(error);
      if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
      const build = {
        label, hash: stats.hash,
        entries: Object.fromEntries([...stats.compilation.entrypoints].map(([name, entry]) => [name, entry.getFiles()])),
        chunks: [...stats.compilation.chunks].map(chunk => ({
          id: chunk.id,
          runtime: typeof chunk.runtime === "string" ? [chunk.runtime] : [...chunk.runtime],
          modules: [...stats.compilation.chunkGraph.getChunkModulesIterable(chunk)]
            .map(m => stats.compilation.chunkGraph.getModuleId(m)).filter(id => id != null),
        })),
        manifests: Object.fromEntries(stats.compilation.getAssets()
          .filter(asset => asset.name.endsWith(".hot-update.json"))
          .map(asset => [asset.name, JSON.parse(fs.readFileSync(path.join(output, asset.name), "utf8"))])),
      };
      builds.push(build);
      resolve(build);
    });
  });
  return {
    output, builds, compile,
    edit(step) { fs.cpSync(path.join(root, "steps", String(step)), path.join(work, "src"), { recursive: true }); },
    async start() {
      await compile("initial");
      require(path.join(output, "main.js"));
      for (let n = 0; !globalThis.app?.hot && n < 1000; n++) await new Promise(r => setTimeout(r, 5));
      if (!globalThis.app?.hot) throw new Error("Entry did not start");
    },
    async update() {
      const before = app.hash();
      try {
        const updated = await app.hot.check(true);
        return { before, after: app.hash(), updated, status: app.hot.status() };
      } catch (error) {
        return { before, error: error.message, status: app.hot.status() };
      }
    },
    save(observed) {
      const result = { webpack: webpack.version, node: process.version, ...observed, builds };
      fs.mkdirSync(path.join(root, "results"), { recursive: true });
      fs.writeFileSync(path.join(root, "results", "last-run.json"), JSON.stringify(result, null, 2) + "\n");
      console.log(JSON.stringify(observed, null, 2));
    },
    close() { return new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve())); },
  };
};
