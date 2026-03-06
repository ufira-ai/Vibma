import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeFlexoki from "starlight-theme-flexoki";

export default defineConfig({
  site: "https://ufira-ai.github.io",
  base: "/Vibma",
  integrations: [
    starlight({
      title: "Vibma",
      description: "AI-powered MCP bridge for designing in Figma",
      plugins: [starlightThemeFlexoki()],
      locales: {
        root: { label: "English", lang: "en" },
        "zh-cn": { label: "简体中文", lang: "zh-CN" },
      },
      defaultLocale: "root",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/ufira-ai/Vibma" },
      ],
      sidebar: [
        {
          label: "Getting Started",
          translations: { "zh-CN": "快速开始" },
          link: "/",
        },
        { label: "Endpoints", slug: "endpoints", translations: { "zh-CN": "端点" } },
        {
          label: "Reference",
          translations: { "zh-CN": "参考" },
          items: [
            { label: "Connection", slug: "tools/connection", translations: { "zh-CN": "连接" } },
            { label: "Pages", slug: "tools/pages", translations: { "zh-CN": "页面" } },
            { label: "Selection", slug: "tools/selection", translations: { "zh-CN": "选区" } },
            { label: "Frames", slug: "tools/frames", translations: { "zh-CN": "框架" } },
            { label: "Text", slug: "tools/text", translations: { "zh-CN": "文本" } },
            { label: "Fonts", slug: "tools/fonts", translations: { "zh-CN": "字体" } },
            { label: "Styles", slug: "tools/styles", translations: { "zh-CN": "样式" } },
            { label: "Variables", slug: "tools/variables", translations: { "zh-CN": "变量" } },
            { label: "Variable Collections", slug: "tools/variable_collections", translations: { "zh-CN": "变量集合" } },
            { label: "Components", slug: "tools/components", translations: { "zh-CN": "组件" } },
            { label: "Instances", slug: "tools/instances", translations: { "zh-CN": "实例" } },
            { label: "Lint", slug: "tools/lint", translations: { "zh-CN": "检查" } },
          ],
        },
        { label: "Prompts", slug: "prompts", translations: { "zh-CN": "提示词" } },
      ],
      customCss: ["./src/styles/tool-reference.css"],
    }),
  ],
});
