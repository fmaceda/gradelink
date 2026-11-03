// Process entry: load env, start the server.
import { createApp } from "./app.ts";

// TODO(TASK-002): read the port from env.ts. 3000 matches the Vite proxy in apps/web/vite.config.ts.
const PORT = 3000;

createApp().listen(PORT);
