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
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/ufira-ai/Vibma" },
      ],
      sidebar: [
        { label: "Overview", link: "/" },
        { label: "Getting Started", slug: "getting-started" },
        {
          label: "Tools",
          items: [
            { label: "Connection", slug: "tools/connection" },
            { label: "Document & Navigation", slug: "tools/document" },
            { label: "Node Inspection", slug: "tools/node-inspection" },
            { label: "Creation", slug: "tools/creation" },
            { label: "Modification", slug: "tools/modification" },
            { label: "Appearance", slug: "tools/appearance" },
            { label: "Layout", slug: "tools/layout" },
            { label: "Styles", slug: "tools/styles" },
            { label: "Variables", slug: "tools/variables" },
            { label: "Components", slug: "tools/components" },
            { label: "Text & Fonts", slug: "tools/text-fonts" },
            { label: "Lint & Export", slug: "tools/lint-export" },
          ],
        },
        { label: "Prompts", slug: "prompts" },
      ],
      customCss: ["./src/styles/tool-reference.css"],
    }),
  ],
});
