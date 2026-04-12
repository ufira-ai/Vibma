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
            { label: "Document", slug: "tools/document", translations: { "zh-CN": "文档" } },
            { label: "Selection", slug: "tools/selection", translations: { "zh-CN": "选区" } },
            { label: "Frames", slug: "tools/frames", translations: { "zh-CN": "框架" } },
            { label: "Text", slug: "tools/text", translations: { "zh-CN": "文本" } },
            { label: "Fonts", slug: "tools/fonts", translations: { "zh-CN": "字体" } },
            { label: "Styles", slug: "tools/styles", translations: { "zh-CN": "样式" } },
            { label: "Variables", slug: "tools/variables", translations: { "zh-CN": "变量" } },
            { label: "Variable Collections", slug: "tools/variable_collections", translations: { "zh-CN": "变量集合" } },
            { label: "Components", slug: "tools/components", translations: { "zh-CN": "组件" } },
            { label: "Instances", slug: "tools/instances", translations: { "zh-CN": "实例" } },
            { label: "Annotations", slug: "tools/annotations", translations: { "zh-CN": "注释" } },
            { label: "Library", slug: "tools/library", translations: { "zh-CN": "库" } },
            { label: "Icons", slug: "tools/icons", translations: { "zh-CN": "图标" } },
            { label: "Images", slug: "tools/images", translations: { "zh-CN": "图片" } },
            { label: "Lint", slug: "tools/lint", translations: { "zh-CN": "检查" } },
            { label: "Prototyping", slug: "tools/prototyping", translations: { "zh-CN": "原型" } },
            { label: "Version History", slug: "tools/version_history", translations: { "zh-CN": "版本历史" } },
            { label: "Help", slug: "tools/help", translations: { "zh-CN": "帮助" } },
            { label: "Guidelines", slug: "tools/guidelines", translations: { "zh-CN": "设计指南" } },
          ],
        },
        { label: "Prompts", slug: "prompts", translations: { "zh-CN": "提示词" } },
      ],
      customCss: ["./src/styles/tool-reference.css"],
    }),
  ],
});
