import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import remarkImageSize from "./src/plugins/remark-image-size";

// BASE_URL is injected by the GitHub Actions configure-pages step.
// Falls back to "/" for local dev and custom-domain deployments.
const baseUrl = process.env.BASE_URL ?? "/";

const config: Config = {
  clientModules: [require.resolve("./src/clientModules/mermaidLightbox.ts")],

  plugins: [
    [
      "@docusaurus/plugin-content-blog",
      {
        id: "case-studies",
        routeBasePath: "case-studies",
        path: "./case-studies",
        blogTitle: "Case Studies",
        blogDescription:
          "How teams use W'xOps Portal in production — real adoption patterns, integration decisions, and lessons learned.",
        blogSidebarTitle: "Case Studies",
        blogSidebarCount: "ALL",
        showReadingTime: true,
        remarkPlugins: [remarkImageSize],
        feedOptions: { type: ["rss", "atom"], xslt: true },
      },
    ],
    [
      "@docusaurus/plugin-content-blog",
      {
        id: "release-notes",
        routeBasePath: "release-notes",
        path: "./release-notes",
        blogTitle: "Release Notes",
        blogDescription:
          "W'xOps Portal release notes — what shipped in each version, what changed, and what's next.",
        blogSidebarTitle: "Releases",
        blogSidebarCount: "ALL",
        showReadingTime: false,
        remarkPlugins: [remarkImageSize],
        feedOptions: { type: ["rss", "atom"], xslt: true },
      },
    ],
  ],

  title: "W'xOps",
  tagline: "Internal Developer Portal for Kubernetes-native teams",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
  },

  url: "https://docs.wxops.cloud",
  baseUrl,

  organizationName: "wxops",
  projectName: "wxops-portal",

  onBrokenLinks: "throw",

  headTags: [
    { tagName: "link", attributes: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
    { tagName: "link", attributes: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "anonymous" } },
    { tagName: "link", attributes: { rel: "icon", type: "image/png", sizes: "16x16", href: "/img/favicon-16x16.png" } },
    { tagName: "link", attributes: { rel: "icon", type: "image/png", sizes: "32x32", href: "/img/favicon-32x32.png" } },
    { tagName: "link", attributes: { rel: "icon", type: "image/png", sizes: "48x48", href: "/img/favicon-48x48.png" } },
    { tagName: "link", attributes: { rel: "apple-touch-icon", sizes: "128x128", href: "/img/favicon-128x128.png" } },
    { tagName: "link", attributes: { rel: "apple-touch-icon", sizes: "256x256", href: "/img/favicon-256x256.png" } },
    { tagName: "link", attributes: { rel: "icon", type: "image/png", sizes: "512x512", href: "/img/favicon-512x512.png" } },
  ],

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  markdown: {
    mermaid: true,
    // Runs on raw markdown before any AST parsing.
    // Converts ![alt](url|WxH) → ![alt](url "WxH") so transformImage
    // sees a clean path, and our remark plugin reads the size from the title.
    preprocessor: ({ fileContent }: { fileContent: string; filePath: string }) =>
      fileContent.replace(
        /!\[([^\]]*)\]\(([^|)"'\s)]+)\|(\d+(?:x\d+)?)\)/g,
        (_, alt, url, size) => `![${alt}](${url} "${size}")`
      ),
  },

  themes: [
    "@docusaurus/theme-mermaid",
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
        indexDocs: true,
        indexBlog: true,
        indexPages: false,
        docsRouteBasePath: "/docs",
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 8,
        searchResultContextMaxLength: 50,
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/wxops/docs-site/tree/main/",
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
          remarkPlugins: [remarkImageSize],
          // "current" (the docs/ folder) is unreleased, in-progress content — the
          // official Docusaurus "Next" pattern: https://docusaurus.io/docs/versioning
          // Served at /docs/next/, never the site's default landing version.
          // lastVersion is the real last tagged release, served at bare /docs/.
          // Older snapshots live in versioned_docs/ and are served at /docs/<version>.
          lastVersion: "0.5.x",
          versions: {
            current: {
              label: "Next",
              path: "next",
              badge: true,
            },
            "0.5.x": {
              label: "0.5.x",
              badge: true,
            },
            "0.4.x": {
              label: "0.4.x",
              badge: true,
              banner: "unmaintained",
            },
          },
        },
        blog: {
          showReadingTime: true,
          remarkPlugins: [remarkImageSize],
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          blogTitle: "W'xOps Blog",
          blogDescription: "Platform engineering insights, architecture decisions, and case studies from the W'xOps team.",
          postsPerPage: 10,
          blogSidebarTitle: "Recent posts",
          blogSidebarCount: "ALL",
        },
        sitemap: {
          lastmod: "date",
          changefreq: "weekly",
          priority: 0.5,
          ignorePatterns: ["/tags/**", "/authors/**"],
          filename: "sitemap.xml",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },

    // Bump the id (announcementBar-N) whenever the message changes, so it
    // reappears for visitors who already dismissed an earlier one.
    announcementBar: {
      id: "announcementBar-0.6.x-oss",
      content:
        "🚀🚀🚀 From 0.6.x &mdash; W&apos;xOps is the open source and open for contribution process. 🚀🚀🚀",
      backgroundColor: "#8b5cf6",
      textColor: "#ffffff",
      isCloseable: true,
    },

    image: "img/wxops-social.png",

    navbar: {
      title: "W'xOps",
      logo: {
        alt: "W'xOps",
        src: "img/favicon-256x256.png",
        width: 32,
        height: 32,
        style: { borderRadius: "8px" },
      },
      hideOnScroll: false,
      items: [
        {
          type: "docSidebar",
          sidebarId: "docs",
          position: "left",
          label: "Docs",
        },
        {
          to: "/docs/cli/overview",
          label: "CLI",
          position: "left",
        },
        {
          to: "/docs/api/reference",
          label: "API",
          position: "left",
        },
        {
          to: "/case-studies",
          label: "Case Studies",
          position: "left",
        },
        {
          to: "/blog",
          label: "Blog",
          position: "left",
        },
        {
          to: "/release-notes",
          label: "Release Notes",
          position: "left",
        },
        {
          type: "docsVersionDropdown",
          position: "right",
          dropdownActiveClassDisabled: true,
        },
        {
          href: "https://wxops.cloud",
          label: "Website",
          position: "right",
        },
        {
          href: "https://github.com/wxops",
          label: "GitHub",
          position: "right",
        },
      ],
    },

    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Introduction", to: "/docs/intro" },
            { label: "Getting Started", to: "/docs/getting-started/deployment" },
            { label: "CLI Reference", to: "/docs/cli/overview" },
            { label: "API Reference", to: "/docs/api/reference" },
            { label: "Blog", to: "/blog" },
            { label: "Release Notes", to: "/release-notes" },
          ],
        },
        {
          title: "Platform",
          items: [
            { label: "Architecture", to: "/docs/concepts/architecture" },
            { label: "Why W'xOps", to: "/docs/concepts/why-wxops" },
            { label: "Golden Path", to: "/docs/scaffolding/golden-path" },
            { label: "Security", to: "/docs/security/permissions" },
          ],
        },
        {
          title: "Features",
          items: [
            { label: "Service Catalog", to: "/docs/catalog/service-catalog" },
            { label: "Scaffold", to: "/docs/scaffolding/golden-path" },
            { label: "Darlane", to: "/docs/darlane/overview" },
          ],
        },
      ],
      // Two lines: team attribution, then the same "from Vietnam" identity the
      // landing site carries (wxops.github.io Footer.tsx) so both properties match.
      copyright: `Copyright © ${new Date().getFullYear()} W'xOps Platform Team. Built with Docusaurus.<br />Made with ❤️ from Vietnam 🇻🇳`,
    },

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "yaml", "go", "typescript", "json"],
    },

    mermaid: {
      theme: { light: "default", dark: "dark" },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
