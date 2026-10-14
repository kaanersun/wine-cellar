# Wine Cellar

A personal wine cellar tracker: scan a label, get the details filled in, know what to open tonight. Built on Supabase, deployed on Vercel, installable as a mobile app.

**Live:** https://wine-cellar-zeta.vercel.app

[Screenshot or short GIF here: the cellar view and a label scan]

## What it does

- Scan a wine label and auto-fill producer, vintage, region, and grape (Claude API)
- Track inventory by location and quantity
- Drink-window recommendations and a "What to Open" list ranked by urgency
- Tasting journal with notes and ratings
- Works offline as a PWA; changes sync when you're back online
- JSON export and import

## How this was built

I'm an operator, not an engineer. I built this by directing Claude Code: describing the behavior I wanted, reading what it produced, and sending back what was wrong. The code is the agent's; the product decisions, the data model, and the review are mine.

Things I pushed back on or changed during the build: [two or three specifics, e.g. the sync conflict rule between offline and cloud copies, how drink windows are scored, what the label scanner should do when it isn't confident].

What I'd do differently: [one or two honest items, e.g. move the Supabase config to env vars from the start, add tests around sync].

## Architecture

- **Frontend:** React 18, Vite, Tailwind, vite-plugin-pwa
- **Database and auth:** Supabase. Postgres tables `wines` and `history`, one row per entry; email and password sign-in
- **Security:** Row Level Security on both tables, so each account sees only its own rows. The Supabase project URL and anon key are public by design; the policies in `supabase/schema.sql` are what protect the data
- **Label scanning:** a serverless function in `api/` calls the Claude API, so the API key stays server-side and never ships to the browser
- **Offline:** a `localStorage` copy of inventory and history; writes made offline are synced on reconnect. On first sign-in, wines already on the device are uploaded to the empty account
