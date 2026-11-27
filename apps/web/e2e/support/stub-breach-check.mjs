// Preloaded into the API (node --import) for the Playwright run only, never in the app itself.
// Sign-up calls the Have I Been Pwned range API; this answers it locally with a hash suffix no
// password has, so automated runs stay off the network and every password passes the check.
// The real call is exercised by hand (TASK-010 criterion 13).
const PWNED_URL = "https://api.pwnedpasswords.com/range/";
const NOT_PWNED = "0000000000000000000000000000000000A:1\n";

const realFetch = globalThis.fetch;

globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  return url.startsWith(PWNED_URL)
    ? Promise.resolve(new Response(NOT_PWNED))
    : realFetch(input, init);
};
