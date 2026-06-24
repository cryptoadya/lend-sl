import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const site =
  process.env.SITE_URL ||
  process.env.PUBLIC_SITE_URL ||
  "https://s-line-seniorenhilfe.de";

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
