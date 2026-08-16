import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // Firebase Admin's Google Cloud dependencies still contain CommonJS
  // `__dirname` probes. Workers are ES modules, so provide a harmless root
  // value instead of leaving a free identifier that Cloudflare rejects while
  // validating the uploaded bundle.
  define: {
    __dirname: JSON.stringify("/"),
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
