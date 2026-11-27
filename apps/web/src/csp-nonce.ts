// Express puts each response's CSP nonce in <meta name="csp-nonce"> (apps/api/src/app.ts).
// Radix's scroll lock (react-remove-scroll, through react-style-singleton) injects a <style>
// element and stamps it with whatever get-nonce returns; get-nonce falls back to the
// __webpack_nonce__ global, which is set here. Without it, the CSP blocks that style and the page
// behind an open Sheet or Dialog keeps scrolling (TASK-010 CSP check, SECURITY.md).
const PLACEHOLDER = "__CSP_NONCE__";

declare global {
  var __webpack_nonce__: string | undefined;
}

export function applyCspNonce(doc: Document = document): void {
  const nonce = doc.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content;
  // The Vite dev server serves the placeholder as is, and sends no CSP.
  if (nonce && nonce !== PLACEHOLDER) {
    globalThis.__webpack_nonce__ = nonce;
  }
}
