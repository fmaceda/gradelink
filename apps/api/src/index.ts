// Process entry: load env, start the server.
import { createApp } from "./app.ts";
import { env } from "./env.ts";

createApp().listen(env.PORT);
