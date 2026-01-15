const esbuild = require("esbuild");
const { nodeExternalsPlugin } = require("esbuild-node-externals");

const shared = {
  bundle: true,
  minify: true,
  sourcemap: true,
  plugins: [nodeExternalsPlugin()],
};

Promise.all([
  // Main entry point (CJS)
  esbuild.build({
    ...shared,
    entryPoints: ["src/index.ts"],
    outfile: "dist/cjs/index.js",
    platform: "node",
    target: ["node14"],
    format: "cjs",
  }),
  // Main entry point (ESM)
  esbuild.build({
    ...shared,
    entryPoints: ["src/index.ts"],
    outfile: "dist/esm/index.js",
    platform: "neutral",
    target: ["es2018"],
    format: "esm",
  }),
  // React entry point (CJS)
  esbuild.build({
    ...shared,
    entryPoints: ["src/react/index.ts"],
    outfile: "dist/cjs/react.js",
    platform: "node",
    target: ["node14"],
    format: "cjs",
    external: ["react", "react-dom"],
  }),
  // React entry point (ESM)
  esbuild.build({
    ...shared,
    entryPoints: ["src/react/index.ts"],
    outfile: "dist/esm/react.js",
    platform: "neutral",
    target: ["es2018"],
    format: "esm",
    external: ["react", "react-dom"],
  }),
]).catch(() => process.exit(1));
