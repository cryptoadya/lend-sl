import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const site =
  process.env.SITE_URL ||
  process.env.PUBLIC_SITE_URL ||
  process.env.CF_PAGES_URL ||
  // Temporary fallback for local builds. Set SITE_URL to the final production URL before deploying.
  "https://example.com";

export default defineConfig({
  output: "static",
  site,
  integrations: [
    sitemap({
      filenameBase: "sitemap",
      namespaces: {
        news: false,
        xhtml: false,
        image: false,
        video: false,
      },
    }),
  ],
});
