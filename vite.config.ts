import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Firebase Admin's Google Cloud dependencies still contain CommonJS
  // `__dirname` probes. Workers are ES modules, so provide a harmless root
  // value instead of leaving a free identifier that Cloudflare rejects while
  // validating the uploaded bundle.
  define: {
    __dirname: JSON.stringify("/"),
  },
  // firebase-admin 14's ESM entrypoints are wrappers around CommonJS. Rolldown
  // currently miscompiles one of those wrappers as `default.SDK_VERSION`.
  // Bundle the underlying modules directly until that interop bug is fixed.
  resolve: {
    alias: [
      ["app", "app"],
      ["auth", "auth"],
      ["firestore", "firestore"],
      ["storage", "storage"],
    ].map(([specifier, directory]) => ({
      find: new RegExp(`^firebase-admin/${specifier}$`),
      replacement: fileURLToPath(
        new URL(
          `./node_modules/firebase-admin/lib/${directory}/index.js`,
          import.meta.url
        )
      ),
    })),
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
