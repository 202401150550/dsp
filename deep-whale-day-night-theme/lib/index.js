// src/manifest.ts
import { readFileSync } from "node:fs";
var id = "maid-atelier";
var light = new Uint8Array(readFileSync(new URL("../preview/light.webp", import.meta.url)));
var dark = new Uint8Array(readFileSync(new URL("../preview/dark.webp", import.meta.url)));
var MAID_ATELIER_REGISTRATION = Object.freeze({
  manifest: Object.freeze({
    formatVersion: 1,
    target: { application: "deepseek-harness", minVersion: "0.1.0-rc.5" },
    id,
    name: "\u6DF1\u9CB8\u663C\u591C",
    nameEn: "Deep Whale Day & Night",
    version: "0.1.7",
    author: "Small-tailqwq & Deep Whale contributors",
    description: "DeepSeek Harness \u7684\u5B8C\u6574\u975E\u5546\u4E1A Deep Whale \u663C\u591C\u4E3B\u9898 UI \u5305\uFF1A\u5305\u542B\u6C34\u6676\u767D\u663C\u4E0E\u6708\u6F6E\u591C\u665A\u573A\u666F\u3001\u89D2\u8272\u4E0E Q \u7248\u5BA0\u7269\u3001\u9CB8\u9C7C\u88C5\u9970\u3001\u73BB\u7483\u9762\u677F\u548C\u8F7B\u91CF\u52A8\u6001\u6C1B\u56F4\uFF1B\u652F\u6301\u4E3B\u673A\u7EA7\u4E3B\u9898\u5361\u7247\u5207\u6362\u4E0E\u5B8C\u6574\u64A4\u9500\u3002\u4EC5\u4F9B\u4E2A\u4EBA\u53CA\u5176\u4ED6\u975E\u5546\u4E1A\u7528\u9014\uFF0C\u7981\u6B62\u5546\u7528\u3002Complete non-commercial Deep Whale day/night UI theme for DeepSeek Harness; personal and non-commercial use only.",
    license: "CC-BY-NC-SA-4.0 \u2014 personal and non-commercial use only",
    entry: "builtin.css",
    cover: "preview/light.webp",
    previews: { light: "preview/light.webp", dark: "preview/dark.webp" },
    colorSchemes: ["light", "dark"]
  }),
  coverSources: Object.freeze({
    "preview/light.webp": { kind: "bytes", bytes: light, mediaType: "image/webp" },
    "preview/dark.webp": { kind: "bytes", bytes: dark, mediaType: "image/webp" }
  })
});

// src/index.ts
var inject = [];
function apply(ctx) {
  const catalog = ctx.get("themeCatalog");
  if (catalog === void 0) return;
  ctx.effect(
    () => catalog.registerBuiltin(MAID_ATELIER_REGISTRATION),
    "ui-skin-maid-atelier: builtin catalog registration"
  );
}
export {
  apply,
  inject
};
