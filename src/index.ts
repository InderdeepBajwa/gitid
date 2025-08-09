#!/usr/bin/env node

import { run } from "./runner";

run().catch((err: unknown) => {
  const message = (err instanceof Error) ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
