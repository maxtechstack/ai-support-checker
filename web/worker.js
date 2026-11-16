// Reads and counts the CSV off the main thread. Classic worker so PapaParse (UMD) loads with importScripts;
// the shared core is an ES module, loaded with import(). Only counts are posted back, never ticket text.
/* global Papa */
importScripts("vendor/papaparse.min.js");

const corePromise = import("../core/index.js");

self.onmessage = async (event) => {
  const { type, file, run } = event.data || {};
  if (type !== "start" || !file) return;
  const post = (msg) => self.postMessage({ ...msg, run });
  const core = await corePromise;
  const feed = core.createRowFeed(core.RULES);
  let lastShare = 0;
  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    chunkSize: 4 * 1024 * 1024,
    beforeFirstChunk(chunk) {
      feed.sniff(chunk);
    },
    chunk(results, parser) {
      const err = feed.rows(results.data);
      if (err) {
        parser.abort();
        return;
      }
      const share = Math.min(1, (results.meta.cursor || 0) / (file.size || 1));
      if (share - lastShare >= 0.02) {
        lastShare = share;
        post({ type: "progress", share });
      }
    },
    complete() {
      const res = feed.finish();
      post(core.isError(res) ? { type: "error", error: res } : { type: "done", result: res });
    },
    error() {
      post({ type: "error", error: { code: "read" } });
    },
  });
};
