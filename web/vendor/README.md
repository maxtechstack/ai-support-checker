# Vendored code

## PapaParse

- **File:** `papaparse.min.js`, unmodified (licence header kept)
- **Version:** 5.4.1
- **Licence:** MIT, see [`papaparse.LICENSE`](papaparse.LICENSE) (Copyright (c) 2015 Matthew Holt)
- **Source:** https://github.com/mholt/PapaParse, npm package [`papaparse@5.4.1`](https://www.npmjs.com/package/papaparse/v/5.4.1)
- **sha256:** `b8e870c5d2b29772f10c9fa9a693c8b896aac8540ed6701e3cc6304c683febdb` (same as `papaparse.min.js` in `npm pack papaparse@5.4.1`)

To check it: `npm pack papaparse@5.4.1`, extract it, and compare `shasum -a 256 package/papaparse.min.js` with this file.

`package.json` here only sets `"type": "commonjs"` so Node can `require()` the file from the CLI.
