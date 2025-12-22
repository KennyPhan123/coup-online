# Coup Online

A multiplayer bluffing card game based on the popular board game Coup. Play with 2-6 players online in real-time.

## Play Now

**Live Game:** https://coup-game-server.kennyphan123.partykit.dev

## Game Rules

In Coup, you start with 2 influence cards (hidden from other players) and 2 coins. Your goal is to be the last player standing.

### Actions

| Action | Cost | Effect | Can Be Blocked | Can Be Challenged |
|--------|------|--------|----------------|-------------------|
| Income | 0 | Take 1 coin | No | No |
| Foreign Aid | 0 | Take 2 coins | Yes (Duke) | No |
| Coup | 7 | Target loses 1 influence | No | No |
| Tax (Duke) | 0 | Take 3 coins | No | Yes |
| Assassinate (Assassin) | 3 | Target loses 1 influence | Yes (Contessa) | Yes |
| Steal (Captain) | 0 | Take 2 coins from target | Yes (Captain/Ambassador) | Yes |
| Exchange (Ambassador) | 0 | Draw 2 cards, keep any 2 | No | Yes |

### Bluffing

You can claim any action, even if you don't have the required card. Other players can challenge your claim - if you're caught bluffing, you lose an influence. If they're wrong, they lose an influence.

## Tech Stack

- **Server:** PartyKit (Cloudflare Workers)
- **Client:** Vanilla JavaScript
- **Styling:** Vanilla CSS
- **Real-time:** WebSocket

## Development

### Prerequisites

- Node.js 17+
- npm

### Run Locally

```bash
# Install dependencies
npm install

# Start development server
npx partykit dev
```

Open http://127.0.0.1:1999 in your browser.

### Deploy

```bash
npx partykit deploy
```

## Project Structure

```
coup-game/
├── party/
│   └── server.js       # PartyKit WebSocket server
├── public/
│   ├── css/
│   │   └── styles.css  # Game styling
│   ├── images/         # Card images
│   ├── js/
│   │   └── app.js      # Client-side logic
│   └── index.html      # Main HTML
├── src/
│   └── game/
│       ├── Game.js     # Game logic
│       ├── constants.js
│       └── utils.js
├── partykit.json       # PartyKit config
└── package.json
```

## License

MIT
