# 🌿 Frieren Archive

> "Even a thousand years of travelling doesn't erase the joy of discovering something new."

A **Frieren: Beyond Journey's End** themed desktop application for anime news, MyAnimeList browsing, quick web search, and ambient sound. Frieren Archive is built as a Ruby on Rails API backend with an Electron desktop frontend, bundled with a portable Ruby runtime and a native FMOD sound engine — giving you a fast, fully self-contained anime companion app for Windows that needs no separate Ruby install to run.

---

## ✨ Features

- 📜 **Anime News** – Aggregated articles served via the Rails API and rendered as Frieren-styled cards, with an in-app native article reader (full content, images, and "Read on Source" fallback) instead of leaving the app.
- 📖 **MyAnimeList (Jikan)** – Search anime and view rich detail pages (synopsis, genres, studios, rank, popularity, members, embedded trailer) using the Jikan REST API — no auth required.
- 🔮 **Quick Search** – Full in-app DuckDuckGo browser (back/forward/reload) via `<webview>`, plus a global Ctrl+K search shortcut.
- 🎬 **Watch Anime** – Dedicated in-app 9Anime webview tab with its own navigation controls.
- ⭐ **Favourites** – Pin and save both news articles and anime entries, browsable in a tabbed Favourites panel with one-click removal.
- 🔊 **FMOD Sound Engine** – Native FMOD-powered audio via a `koffi`-based Node bridge: contextual UI SFX (click, hover, open, back, success, error), looping background music with playlist support, master/music/SFX volume sliders, mute-all toggle, and output device selection — all persisted across sessions via `localStorage`.
- 🌨️ **Frieren-themed UI** – Deep navy, silver, teal, and gold palette with ambient snow particle effects and a custom frameless title bar.
- ⚙️ **Settings Panel** – API connection status, SFW content filter toggle, audio device/volume controls, theme information, and app version.
- 📦 **Self-contained Windows build** – Ships with a portable Ruby 3.4 runtime and bundled Rails app (including `vendor/bundle` gems) inside the packaged Electron app — end users need nothing installed to run the `.exe`.

---

## 🛠 Tech Stack

| Layer | Technology |
|----------|-----------------------------------|
| Backend | Ruby on Rails 8.1.2 (API mode) |
| Database | SQLite 3 (development/production) |
| Frontend | Electron 41 + Vanilla JS |
| Audio | FMOD Core API via `koffi` (native DLL bridge) |
| Packaging | Electron Forge (Squirrel + zip makers) |
| Fonts | Cinzel (headings) · Inter (body) |
| CI/CD | GitHub Actions |
| IDE | RubyMine 2024+ |
| Platform | Windows 10/11 |

---

## 📋 Requirements

| Tool | Version | Download |
|----------|----------|--------------------------------------------------------------------------|
| Ruby | 3.4.8 | [rubyinstaller.org](https://rubyinstaller.org/downloads/) (Ruby+Devkit) |
| Bundler | 2.x | `gem install bundler` |
| Node.js | 24.x LTS | [nodejs.org](https://nodejs.org/) |
| npm | 11.x | Bundled with Node |
| Git | any | [git-scm.com](https://git-scm.com/) |
| RubyMine | 2024+ | [jetbrains.com/ruby](https://www.jetbrains.com/ruby/) |
| FMOD Engine | 2.x | [fmod.com/download](https://www.fmod.com/download) (Core API, Windows) |

Verify all tools are installed:

```bash
ruby -v      # ruby 3.4.8
bundle -v    # Bundler version 2.x
node -v      # v24.x.x
npm -v       # 11.x.x
git --version # git version 2.x
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/FrierenAnimeArchive.git
cd FrierenAnimeArchive
```

Open in RubyMine: **File → Open** → select the `FrierenAnimeArchive` folder.

### 2. Configure Ruby SDK in RubyMine

- Go to **File → Project Structure → SDKs**.
- Click **+ → Ruby SDK**.
- Select your Ruby 3.4.8 path (for example `C:\Ruby34-x64\bin\ruby.exe`).
- Click **Apply → OK**.

### 3. Install Ruby dependencies

```bash
bundle install
```

### 4. Set up environment variables

```bash
cp .env.example .env
```

Open `.env`. For local development all defaults work out of the box. No API keys are required for Jikan or DuckDuckGo:

```env
# MyAnimeList OAuth (optional — only needed for user list write access)
MAL_CLIENT_ID=
MAL_CLIENT_SECRET=

# Rails environment
RAILS_ENV=development
```

> `.env` is gitignored. Never commit secrets.

### 5. Set up the database

```bash
bin/rails db:create
bin/rails db:migrate
bin/rails db:seed
```

This creates `db/development.sqlite3`, runs all migrations, and seeds the database with sample news articles so the app has content immediately.

### 6. Start the Rails API server

```bash
bin/rails server
```

Rails starts at `http://localhost:3001` (production build) / `http://localhost:3000` (dev). Confirm it is running:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "rails_version": "8.1.2",
  "ruby_version": "3.4.8",
  "time": "2026-03-20T11:27:25.373Z"
}
```

### 7. Install Electron dependencies

```bash
cd desktop
npm install
```

### 8. Launch the Electron app

With Rails still running in the first terminal:

```bash
cd desktop
npm run dev
```

The **Frieren Archive** window opens. Click **Check Health** to confirm the Rails connection, then **Load News** to see seeded articles rendered as Frieren-themed cards. Background music and UI sound effects will start automatically once FMOD initializes.

---

## 📁 Project Structure

```text
FrierenAnimeArchive/
├── app/
│   ├── controllers/
│   │   └── api/
│   │       ├── health_controller.rb   # GET /api/health
│   │       └── news_controller.rb     # GET /api/news
│   └── models/
│       ├── article.rb
│       └── source.rb
├── config/
│   └── routes.rb
├── db/
│   ├── migrate/
│   ├── schema.rb
│   └── seeds.rb
├── vendor/
│   └── bundle/               # Bundled gems, copied into packaged builds
├── desktop/
│   ├── main.js                # Electron main process — Rails spawn, FMOD IPC, window lifecycle
│   ├── preload.js             # Secure IPC bridge (window.api / window.sound)
│   ├── forge.config.js        # Electron Forge build config — ruby-runtime + rails-api packaging
│   ├── index.html
│   ├── loading.html
│   ├── package.json
│   ├── ruby-runtime/           # Portable Ruby 3.4 runtime (bundled into production builds)
│   ├── Icon/
│   ├── audiofiles/             # Source SFX and music assets
│   ├── out/                    # Electron Forge build output
│   └── renderer/
│       ├── styles/
│       │   ├── main.css        # Frieren design tokens + full layout
│       │   └── loading.css
│       ├── soundengine/
│       │   ├── fmod_js/
│       │   │   ├── fmod.js     # koffi FMOD bridge — init, play, volume, devices, categories
│       │   │   ├── fmod.dll
│       │   │   └── fmodL.dll   # Logging/debug build of FMOD
│       └── js/
│           ├── snow.js         # Ambient snow particle animation
│           ├── nav.js          # Sidebar tab switching
│           ├── loadingSCRN.js  # Boot/loading screen logic
│           ├── manga.js
│           └── app.js          # API calls, DOM rendering, sound UI wiring, favourites, boot sequence
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI pipeline
├── .env.example
├── .gitignore
├── Gemfile
├── Gemfile.lock
└── README.md
```

---

## 🔌 API Endpoints

All endpoints are prefixed with `/api`.

| Method | Endpoint | Description |
|--------|------------------------|----------------------------------------------|
| GET | `/api/health` | Rails + Ruby version and timestamp |
| GET | `/api/news` | Paginated list of news articles |
| POST | `/api/news/refresh` | Wipes and re-fetches news from RSS sources |
| GET | `/api/news/content?url=` | Fetches and cleans full article content for the in-app reader |
| GET | `/api/news/:id` | Single article detail |
| GET | `/api/anime/search?q=&sfw=` | Anime search via Jikan API, with SFW filter |
| GET | `/api/anime/:id` | Anime detail by MyAnimeList ID |
| GET | `/api/search/web?q=` | DuckDuckGo Instant Answer proxy |
| POST | `/api/mal/connect` | Begin MAL OAuth2 flow *(planned)* |
| GET | `/api/mal/callback` | Handle MAL OAuth2 callback *(planned)* |
| GET | `/api/mal/me` | Authenticated MAL user profile *(planned)* |

---

## 🔊 Sound Engine (FMOD)

Frieren Archive uses **FMOD Core API** via a `koffi`-based native bridge (`renderer/soundengine/fmod_js/fmod.js`) for all audio, exposed to the renderer through `window.sound` in `preload.js`.

| Feature | Description |
|---|---|
| Contextual SFX | `ui`, `click`, `hover`, `open`, `back`, `success`, `error` categories, auto-triggered on interactive elements |
| Background music | Looping playlist support with track persistence across sessions |
| Volume controls | Independent master, music, and SFX volume sliders (0–100%, stored as 0.0–1.0 internally) |
| Mute all | Single toggle to silence all audio without losing volume settings |
| Output device selection | Enumerate and switch system playback devices at runtime |
| Settings persistence | All audio preferences saved to `localStorage` and restored on boot |

IPC channels (`main.js` ↔ `preload.js`): `sound:play-sfx`, `sound:play-any`, `sound:play-music`, `sound:stop-music`, `sound:list-music`, `sound:is-music-playing`, `sound:set-master-volume`, `sound:set-music-volume`, `sound:set-sfx-volume`, `sound:set-mute-all`, `sound:list-output-devices`, `sound:set-output-device`, `sound:categories`.

---

## 🗄️ Database

Frieren Archive uses **SQLite 3**, so no separate database server is required. In packaged builds, the database files live in `userData` (e.g. `production.sqlite3`, `production_cache.sqlite3`, `production_queue.sqlite3`, `production_cable.sqlite3`) rather than inside the app bundle, so user data persists across updates.

Common database tasks:

```bash
bin/rails db:create          # create development + test databases
bin/rails db:migrate         # run all pending migrations
bin/rails db:seed            # load sample articles and sources
bin/rails db:reset           # drop → create → migrate → seed
bin/rails db:test:prepare    # sync schema to test database
```

### Models

| Model | Description |
|-------------|--------------------------------------------------------------------------|
| **Source** | A named feed origin (for example "Jikan News", "ANN"). Has many articles. |
| **Article** | A news article. Belongs to Source. Has title, summary, body, image_url, published_at, and tags. |

---

## 🧪 Testing

```bash
# Prepare the test database
bundle exec rails db:test:prepare

# Run all tests
bundle exec rails test

# Run with verbose output
bundle exec rails test --verbose

# Run a specific file
bundle exec rails test test/models/article_test.rb
```

---

## 🔍 Linting & Security

```bash
# RuboCop — style enforcement
bundle exec rubocop

# Auto-fix all safe offences
bundle exec rubocop -a

# Auto-fix including unsafe offences (review diff carefully)
bundle exec rubocop -A

# Brakeman — static security analysis
bundle exec brakeman --no-pager

# bundler-audit — CVE check on all gems
bundle exec bundler-audit check --update
```

---

## ⚙️ CI/CD (GitHub Actions)

Three jobs run automatically on every push and pull request to `master`:

| Job | Description |
|------------|--------------------------------------------------|
| `security` | Brakeman static scan + bundler-audit CVE check |
| `lint` | RuboCop with GitHub annotation output |
| `test` | Prepares test DB and runs the full Rails test suite |

Pipeline file: `.github/workflows/ci.yml`.

---

## 🌐 Third-party Integrations

### Jikan API (MyAnimeList — read-only)

- Base URL: `https://api.jikan.moe/v4`
- No API key required.
- Rate limits: 60 req/min, 3 req/sec — respected via ETag caching in Rails.
- Used for anime search, detail pages, and trailer embeds.

### DuckDuckGo Instant Answer API

- Base URL: `https://api.duckduckgo.com`
- Typical query params: `format=json&no_html=1&skip_disambig=1`.
- Backs the Quick Search tab and the full in-app DuckDuckGo `<webview>` browser.

### 9Anime (Watch Anime tab)

- Rendered entirely in an isolated `<webview>` with its own back/forward/reload controls.
- No Rails proxy involved — direct iframe-style navigation inside the app shell.

### MyAnimeList Official API v2 *(planned)*

- Register at `https://myanimelist.net/apiconfig`.
- Add `MAL_CLIENT_ID` and `MAL_CLIENT_SECRET` to `.env`.
- Enables OAuth2 login and reading/updating authenticated user lists.

---

## 🖥️ Electron Security Model

- `nodeIntegration: false` enforced in the renderer process.
- `contextIsolation: true` enforced.
- All Rails communication goes through `preload.js`, exposed as `window.api`.
- All FMOD sound engine communication goes through `preload.js`, exposed as `window.sound`.
- `<webview>` tags are sandboxed for DuckDuckGo and 9Anime; external links open via `shell.openExternal` rather than in-app navigation.
- A custom Content Security Policy is applied via session response headers in `main.js` for local `file://` content.
- Frameless custom title bar (`win-minimize`, `win-maximize`, `win-close` IPC) replaces the OS chrome.

---

## 🚢 Deployment & Packaging

### Package a Windows installer

```bash
cd desktop
npm run make   # Electron Forge — Output: desktop/out/make/
```

The app is packaged with **Electron Forge**, using a `postPackage` hook (`forge.config.js`) to:

1. Copy the portable Ruby 3.4 runtime into `resources/ruby-runtime`.
2. Copy the Rails repo (excluding dev-only folders) into `resources/rails-api`.
3. Copy `vendor/bundle` gems directly into `resources/rails-api/vendor/bundle`.
4. Write a `.bundle/config` pointing Bundler at the bundled gems in production.

This produces a self-contained Windows build (Squirrel installer + zip) that needs no separate Ruby, Bundler, or gem installation on the end user's machine — `main.js` spawns the bundled Ruby binary directly against the bundled Rails app on first launch.

### Deploy Rails to a remote server (optional)

If you want the API accessible from a deployed machine instead of localhost:

```bash
RAILS_ENV=production bin/rails db:migrate
RAILS_ENV=production bin/rails server -b 0.0.0.0
```

Update the Rails base URL in `desktop/preload.js` (`RAILS_BASE`) to point to your server URL, then rebuild the Electron package.

---

## 🔧 Services

| Service | Purpose | Default |
|---------------------|----------------------------------------------|--------------------------|
| Puma (Rails) | HTTP server for the API | `localhost:3001` (packaged) / `localhost:3000` (dev) |
| SQLite | Embedded database, no server required | `db/development.sqlite3` (dev) / `userData/production.sqlite3` (packaged) |
| FMOD | Native audio playback engine | Loaded via `koffi` from bundled DLLs |
| Sidekiq *(planned)* | Background job processing for news refresh | Redis required |
| Redis *(planned)* | Sidekiq backend for periodic news fetch jobs | `localhost:6379` |

For now, Sidekiq and Redis are not required — news is fetched on demand when the user clicks **Load News**.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Write tests for new functionality.
4. Run linting before committing: `bundle exec rubocop -a`.
5. Commit with a meaningful message.
6. Open a pull request against `master`.

Please keep pull requests focused and small. Each PR should do one thing.

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm run dev` → `ENOENT package.json` | You are in the wrong directory. Run `cd desktop` first. |
| `npm run dev` → `Missing script: dev` | Add `"dev": "electron ."` to `desktop/package.json` scripts. |
| `ECONNREFUSED localhost:3001` in Electron | Rails is not running or still starting. Check `userData/rails.log` via `window.api.openLog()`. |
| `schema.rb` doesn't exist | Run `bin/rails db:migrate`. |
| RuboCop `Style/StringLiterals` errors | Run `bundle exec rubocop -a` to auto-fix. |
| Binstub error `Beginning in Rails 4...` | Run `bundle exec rails app:update:bin --force`. |
| Fonts not loading in Electron | Check the CSP `font-src` directive in `main.js` session hooks allows `fonts.gstatic.com`. |
| `api_news_index_url` undefined in tests | Delete the auto-generated controller test files for namespaced API controllers. |
| `FMOD DLL not found` in packaged build | Ensure `asar.unpackDir` in `forge.config.js` points to `renderer/soundengine/fmod_js`, or the DLLs stay compressed inside `app.asar` and can't be loaded natively. |
| No sound at all after a settings change | Check volume values are 0.0–1.0 (not 0–100) before calling `window.sound.setMasterVolume`/`setMusicVolume`/`setSfxVolume`, and confirm `getMuted()` isn't returning a truthy string from `localStorage`. |
| `vendor/bundle MISSING` during `npm run make` | Run `bundle install` in the Rails root before packaging — the Forge hook fails the build intentionally if gems aren't present. |

---

## 🤖 AI Coding Assistants

This project was built with assistance from the following AI tools:

| Tool | Usage |
|-------------------|-----------------------------------------------------------------------|
| **Perplexity AI** | Architecture design, UI code generation, Rails API design, CI configuration, Electron Forge packaging, FMOD sound engine integration, debugging, README authoring |
| **GitHub Copilot**| Inline code suggestions inside RubyMine during development |

All AI-generated code was reviewed, tested, and adapted by the developer before committing.

---

## 📄 License

MIT License

Copyright (c) 2026 FrierenAnimeArchive Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## 🌿 Acknowledgements

- *Frieren: Beyond Journey's End* by Kanehito Yamada & Tsukasa Abe — for the world and aesthetic that inspired this app.
- [Jikan API](https://jikan.moe/) — unofficial MyAnimeList REST API.
- [DuckDuckGo Instant Answer API](https://duckduckgo.com/api) — privacy-focused search.
- [Electron](https://www.electronjs.org/) — cross-platform desktop apps.
- [Electron Forge](https://www.electronforge.io/) — packaging and distribution for Windows.
- [FMOD](https://www.fmod.com/) — native audio engine powering all in-app sound.
- [koffi](https://koffi.dev/) — Node.js native FFI bridge used to call FMOD from JavaScript.
- [Ruby on Rails](https://rubyonrails.org/) — backend framework powering the API.
- [Cinzel](https://fonts.google.com/specimen/Cinzel) — Google Font used for headings.
- [Inter](https://fonts.google.com/specimen/Inter) — Google Font used for body text.
- [RubyMine](https://www.jetbrains.com/ruby/) — IDE used throughout development.
- [Perplexity AI](https://www.perplexity.ai/) — AI assistant used for architecture, UI design, and debugging.