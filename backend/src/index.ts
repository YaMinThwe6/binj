import { createApp } from "./app.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";

const app = createApp();
const port = Number(env.PORT);

app.listen(port, () => {
  logger.info(`BINJ backend listening on http://localhost:${port}`);
});
