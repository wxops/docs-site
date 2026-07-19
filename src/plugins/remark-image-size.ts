// Works in two steps with the markdown.preprocessor in docusaurus.config.ts:
//
// 1. Preprocessor rewrites ![alt](url|500x300) → ![alt](url "500x300")
//    so Docusaurus's transformImage can resolve the file path normally.
//
// 2. transformImage converts image nodes to mdxJsxTextElement and carries
//    the title value across as a `title` JSX attribute.
//
// 3. This plugin (runs after transformImage) finds those JSX <img> nodes,
//    reads the size from the title attribute, replaces width/height with
//    the user-specified values, and removes the title so it won't appear
//    as a browser tooltip.

const SIZE_RE = /^(\d+)(?:x(\d+))?$/;

function processJsxImg(node: any): void {
  const attrs: any[] = node.attributes ?? [];

  const titleAttr = attrs.find(
    (a) => a.type === "mdxJsxAttribute" && a.name === "title"
  );
  if (!titleAttr) return;

  const match = String(titleAttr.value).match(SIZE_RE);
  if (!match) return;

  // Drop title, existing width, existing height (transformImage auto-detects them)
  node.attributes = attrs.filter(
    (a) =>
      !(
        a.type === "mdxJsxAttribute" &&
        (a.name === "title" || a.name === "width" || a.name === "height")
      )
  );

  node.attributes.push({ type: "mdxJsxAttribute", name: "width", value: match[1] });
  if (match[2]) {
    node.attributes.push({ type: "mdxJsxAttribute", name: "height", value: match[2] });
  }
}

function walk(node: any): void {
  if (node.type === "mdxJsxTextElement" && node.name === "img") {
    processJsxImg(node);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child);
  }
}

export default function remarkImageSize() {
  return (tree: any) => walk(tree);
}
