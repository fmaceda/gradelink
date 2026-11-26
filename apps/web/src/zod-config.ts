import { z } from "zod";

// Imported first by main.tsx, because Zod runs this probe when a schema is built, while modules
// load. Zod probes for eval with new Function to compile faster object parsers. script-src 'self'
// blocks it, and the browser reports a CSP violation even though Zod catches the error (TASK-010
// CSP check). The client parses small payloads, so the interpreted parsers are fine.
z.config({ jitless: true });
