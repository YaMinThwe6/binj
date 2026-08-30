// Refreshes the cached "recently released" movies list backing GET
// /movies/recent (api-contracts.md §1) — written to discover/recentMovies
// so that endpoint reads from Firestore instead of hitting TMDB live on
// every single request. hld.md §18 already documents that this endpoint
// (and search) shortcut past its own "search must never depend on TMDB
// live" design for the prototype's timeline; this script is the missing
// other half of that shortcut — cached, refreshed periodically, rather
// than either "always live" or a real ingestion pipeline.
//
// Same "run manually for now" shortcut as computeTasteMatches.ts: a real
// Cloud Scheduler job is the eventual upgrade path once there's enough
// traffic to justify standing it up — this script implements the exact
// same write either way, so swapping the trigger later is infra, not logic.
//
// Run manually for now: pnpm --filter binj-backend run refresh-recent-movies

import { requireDb } from "../src/lib/firebaseAdmin.js";
import { getRecentMovies } from "../src/lib/tmdb.js";
import { pathToFileURL } from "node:url";

async function main() {
  const db = requireDb();
  const items = await getRecentMovies();
  await db.collection("discover").doc("recentMovies").set({ items, updatedAt: new Date() });
  console.log(`Refreshed recently-released movies cache: ${items.length} items.`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
