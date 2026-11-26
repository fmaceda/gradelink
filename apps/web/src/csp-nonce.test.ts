import { afterEach, describe, expect, it } from "vitest";
import { applyCspNonce } from "./csp-nonce";

function documentWith(head: string) {
  return new DOMParser().parseFromString(`<html><head>${head}</head></html>`, "text/html");
}

afterEach(() => {
  globalThis.__webpack_nonce__ = undefined;
});

describe("applyCspNonce", () => {
  it("hands the served nonce to get-nonce's global", () => {
    applyCspNonce(documentWith('<meta name="csp-nonce" content="c2VydmVkLW5vbmNl" />'));

    expect(globalThis.__webpack_nonce__).toBe("c2VydmVkLW5vbmNl");
  });

  it.each([
    ["the dev server's placeholder", '<meta name="csp-nonce" content="__CSP_NONCE__" />'],
    ["no meta tag", ""],
  ])("sets nothing for %s", (_label, head) => {
    applyCspNonce(documentWith(head));

    expect(globalThis.__webpack_nonce__).toBeUndefined();
  });
});
