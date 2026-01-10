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

- **Local**: Data is stored in `localStorage` on your device
- **Export**: Use the Export button to download JSON backups
- **Import**: Use the Import button to restore from JSON

Storage keys:
- `wine-cellar-inventory` - Your wine collection
- `wine-cellar-history` - Tasting notes and history

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- PWA (vite-plugin-pwa)
- Lucide icons
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
│   ├── main.jsx           # Entry point
│   └── index.css          # Tailwind styles
├── index.html
├── package.json
├── vite.config.js         # Vite + PWA config
├── tailwind.config.js
└── postcss.config.js
```

## License

MIT - Use it however you'd like!
