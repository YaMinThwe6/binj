import { createApp } from "./app.js";
import { env } from "./lib/env.js";

const app = createApp();
const port = Number(env.PORT);

app.listen(port, () => {
  console.log(`BINJ backend listening on http://localhost:${port}`);
});
