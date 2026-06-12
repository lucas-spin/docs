/// <reference types="vite/client" />

// MDX file types
declare module "*.md" {
  const mdx: string;
  const markdown: string;
  const filename: string;
  export { mdx, markdown, filename };
  export default mdx;
}

// Allow importing .wasm files as served URLs via Vite's ?url query
declare module "*.wasm?url" {
  const url: string;
  export default url;
}