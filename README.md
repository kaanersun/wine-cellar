# Wine Cellar

A personal wine cellar tracker with label scanning, drink windows, and tasting notes.

## Features

- 📷 Scan wine labels to auto-fill details (uses Claude API)
- 🍷 Track cellar inventory with locations and quantities
- ⏰ Drink window recommendations from CellarTracker & wine databases
- ✨ "What to Open" suggestions prioritized by urgency
- 📖 Wine journal with tasting notes and ratings
- 📱 Works offline as a mobile app (PWA)
- 💾 Export/Import data as JSON

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

## Deploy to Vercel (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create wine-cellar --public --push
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click "New Project" → Import your repo → Deploy
   - Takes about 60 seconds

3. **Add to your phone:**
   - Open your Vercel URL on your phone
   - **iOS**: Safari → Share → "Add to Home Screen"
   - **Android**: Chrome → Menu → "Install app"

## Alternative: Deploy to Netlify

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

## Using with Claude Code

Export your wine data from the app, then use it with Claude Code:

```bash
# Start Claude Code in your project directory
claude

# Ask Claude to analyze your collection
> "Load wine-cellar-full-2026-01-10.json and tell me which wines I should drink soon"
> "Create a chart showing my wine collection by region"
> "Find wines in my cellar that pair well with steak"
```

## Data Storage

Data is stored in [Supabase](https://supabase.com) (Postgres), so your cellar syncs across devices. You sign in with email and password.

- **Cloud**: tables `wines` and `history`, one row per entry, protected by Row Level Security so each account only sees its own data
- **Offline**: a copy is kept in `localStorage` (`wine-cellar-inventory`, `wine-cellar-history`); changes made offline sync when you're back online
- **First sign-in**: if the account is empty, wines already stored on that device are uploaded
- **Export / Import**: JSON backups still work as before

### Supabase setup

1. Create a Supabase project
2. In the SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql)
3. In Authentication → URL Configuration, set the Site URL to your deployed URL (confirmation emails link there)
4. The project URL and anon key are set in `src/supabase.js`; to use a different project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- PWA (vite-plugin-pwa)
- Lucide icons
- Supabase (database and sign-in)
- Claude API (for label scanning)

## Generating App Icons

The app needs PNG icons for PWA. Create them from the SVG:

```bash
# Using ImageMagick
convert -background none public/wine-icon.svg -resize 192x192 public/wine-icon-192.png
convert -background none public/wine-icon.svg -resize 512x512 public/wine-icon-512.png

# Or use an online tool like realfavicongenerator.net
```

## Project Structure

```
wine-cellar/
├── public/
│   └── wine-icon.svg      # App icon
├── src/
│   ├── WineCellar.jsx     # Main app component
│   ├── Auth.jsx           # Sign-in screen
│   ├── supabase.js        # Supabase client
│   ├── sync.js            # Cloud sync
│   ├── main.jsx           # Entry point
│   └── index.css          # Tailwind styles
├── supabase/
│   └── schema.sql         # Database tables and security rules
├── index.html
├── package.json
├── vite.config.js         # Vite + PWA config
├── tailwind.config.js
└── postcss.config.js
```

## License

MIT - Use it however you'd like!
