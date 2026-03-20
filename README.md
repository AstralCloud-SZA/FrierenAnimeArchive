# 🌿 Frieren Archive

> *"Even a thousand years of travelling doesn't erase the joy of discovering something new."*

A Frieren: Beyond Journey's End themed desktop application for anime news, MyAnimeList browsing, and quick web search. Built with a Ruby on Rails 8.1 API backend and an Electron 41 desktop frontend for Windows.

---

## ✨ Features

- 📜 **Anime News** — aggregated articles fed through the Rails API
- 📖 **MyAnimeList** — anime search and details powered by the Jikan API (no auth required)
- 🔮 **Quick Search** — DuckDuckGo Instant Answer integration for fast lookups
- ⭐ **Favourites** — pin and save articles and saved anime entries
- 🌨️ **Frieren-themed UI** — deep navy, silver, teal and gold design with ambient snow particles
- ⚙️ **Settings** — API connection status, theme info, app version

---

## 🛠 Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Ruby on Rails 8.1.2 (API mode)    |
| Database | SQLite 3 (development/production) |
| Frontend | Electron 41 + Vanilla JS          |
| Fonts    | Cinzel (headings) · Inter (body)  |
| CI/CD    | GitHub Actions                    |
| IDE      | RubyMine 2024+                    |
| Platform | Windows 10/11                     |

---

## 📋 Requirements

| Tool     | Version  | Download                                                                 |
|----------|----------|--------------------------------------------------------------------------|
| Ruby     | 3.4.8    | [rubyinstaller.org](https://rubyinstaller.org/downloads/) — Ruby+Devkit  |
| Bundler  | 2.x      | `gem install bundler`                                                    |
| Node.js  | 24.x LTS | [nodejs.org](https://nodejs.org/)                                        |
| npm      | 11.x     | Bundled with Node                                                        |
| Git      | any      | [git-scm.com](https://git-scm.com/)                                      |
| RubyMine | 2024+    | [jetbrains.com/ruby](https://www.jetbrains.com/ruby/)                    |

Verify all tools are installed:

```bash
ruby -v       # ruby 3.4.8
bundle -v     # Bundler version 2.x
node -v       # v24.x.x
npm -v        # 11.x.x
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

- Go to **File → Project Structure → SDKs**
- Click **+** → **Ruby SDK**
- Select your Ruby 3.4.8 path (e.g. `C:\Ruby34-x64\bin\ruby.exe`)
- Click **Apply → OK**

### 3. Install Ruby dependencies

In the RubyMine terminal (**View → Tool Windows → Terminal**):

```bash
bundle install
```

### 4. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` — for local development all defaults work out of the box. No API keys are required for Jikan or DuckDuckGo:

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

Rails starts at **http://localhost:3000**. Confirm it is running:

```bash
curl http://localhost:3000/api/health
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

Open a **second terminal tab** in RubyMine:

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

The **Frieren Archive** window opens. Click **Check Health** to confirm the Rails connection, then **Load News** to see seeded articles rendered as Frieren-themed cards. 🎉

---

## 📁 Project Structure

```
FrierenAnimeArchive/
├── app/
│   ├── controllers/
│   │   └── api/
│   │       ├── health_controller.rb      # GET /api/health
│   │       └── news_controller.rb        # GET /api/news
│   └── models/
│       ├── article.rb
│       └── source.rb
├── config/
│   └── routes.rb
├── db/
│   ├── migrate/
│   ├── schema.rb
│   └── seeds.rb
├── desktop/
│   ├── main.js                           # Electron main process
│   ├── preload.js                        # Secure IPC bridge (window.frieren)
│   ├── index.html                        # App shell
│   ├── package.json
│   └── renderer/
│       ├── styles/
│       │   └── main.css                  # Frieren design tokens + full layout
│       └── js/
│           ├── snow.js                   # Ambient snow particle animation
│           ├── nav.js                    # Sidebar tab switching
│           └── app.js                    # API calls + DOM rendering
├── .github/
│   └── workflows/
│       └── ci.yml                        # GitHub Actions CI pipeline
├── .env.example
├── .gitignore
├── Gemfile
├── Gemfile.lock
└── README.md
```

---

## 🔌 API Endpoints

All endpoints are prefixed with `/api`.

| Method | Endpoint                  | Description                               |
|--------|---------------------------|-------------------------------------------|
| GET    | `/api/health`             | Rails + Ruby version, timestamp           |
| GET    | `/api/news`               | Paginated list of news articles           |
| GET    | `/api/news/:id`           | Single article detail                     |
| GET    | `/api/anime/search?q=`    | Anime search via Jikan API                |
| GET    | `/api/anime/:id`          | Anime detail by MAL ID                    |
| GET    | `/api/search/web?q=`      | DuckDuckGo Instant Answer proxy           |
| POST   | `/api/mal/connect`        | Begin MAL OAuth2 flow *(planned)*         |
| GET    | `/api/mal/callback`       | Handle MAL OAuth2 callback *(planned)*    |
| GET    | `/api/mal/me`             | Authenticated MAL user profile *(planned)*|

---

## 🗄️ Database

This app uses **SQLite 3** — no separate database server needed.

```bash
bin/rails db:create        # create development + test databases
bin/rails db:migrate       # run all pending migrations
bin/rails db:seed          # load sample articles and sources
bin/rails db:reset         # drop → create → migrate → seed
bin/rails db:test:prepare  # sync schema to test database
```

### Models

| Model       | Description                                                              |
|-------------|--------------------------------------------------------------------------|
| **Source**  | A named feed origin (e.g. "Jikan News", "ANN"). Has many articles.       |
| **Article** | A news article. Belongs to Source. Has title, summary, body, image_url, published_at, tags. |

---

## 🧪 Running the Test Suite

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

| Job        | Description                                     |
|------------|-------------------------------------------------|
| `security` | Brakeman static scan + bundler-audit CVE check  |
| `lint`     | RuboCop with GitHub annotation output           |
| `test`     | Prepares test DB and runs full Rails test suite |

Pipeline file: `.github/workflows/ci.yml`

---

## 🌐 Third-party Integrations

### Jikan API (MyAnimeList — read-only)
- Base URL: `https://api.jikan.moe/v4`
- No API key required
- Rate limits: 60 req/min, 3 req/sec — respected via ETag caching in Rails
- Used for: anime search, anime detail pages, news discovery

### DuckDuckGo Instant Answer API
- Base URL: `https://api.duckduckgo.com`
- No API key required
- Query params: `format=json&no_html=1&skip_disambig=1`
- Used for: Quick Search tab — returns abstract, heading, image, related topics

### MyAnimeList Official API v2 *(planned)*
- Register at: https://myanimelist.net/apiconfig
- Add `MAL_CLIENT_ID` and `MAL_CLIENT_SECRET` to `.env`
- Enables: OAuth2 login, reading and updating authenticated user lists

---

## 🖥️ Electron Security Model

- `nodeIntegration: false` enforced in the renderer process
- `contextIsolation: true` enforced
- All Rails communication goes through `preload.js` exposed as `window.frieren`
- No external URLs loaded in `BrowserWindow` except `localhost:3000`
- Content Security Policy meta tag set in `index.html`

---

## 🚢 Deployment & Packaging

### Package a Windows installer

```bash
cd desktop
npm run build
# Output: desktop/dist/FrierenArchive Setup x.x.x.exe
```

Packaged with `electron-builder`. Produces a standard Windows `.exe` NSIS installer.

### Deploy Rails to a remote server (optional)

If you want the API accessible from a deployed machine instead of localhost:

```bash
RAILS_ENV=production bin/rails db:migrate
RAILS_ENV=production bin/rails server -b 0.0.0.0
```

Update `API_BASE_URL` in `desktop/main.js` to point to your server URL, then rebuild the Electron package.

---

## 🔧 Services

| Service             | Purpose                                      | Default             |
|---------------------|----------------------------------------------|---------------------|
| Puma (Rails)        | HTTP server for the API                      | `localhost:3000`    |
| SQLite              | Embedded database, no server required        | `db/development.sqlite3` |
| Sidekiq *(planned)* | Background job processing for news refresh   | Redis required      |
| Redis *(planned)*   | Sidekiq backend for periodic news fetch jobs | `localhost:6379`    |

For now Sidekiq and Redis are not required — news is fetched on demand when the user clicks **Load News**.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests for new functionality
4. Run linting before committing: `bundle exec rubocop -a`
5. Commit with a meaningful message
6. Open a pull request against `master`

Please keep PRs focused and small. Each PR should do one thing.

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm run dev` — `ENOENT package.json` | You are in the wrong directory. Run `cd desktop` first. |
| `npm run dev` — `Missing script: dev` | Add `"dev": "electron ."` to `desktop/package.json` scripts. |
| `ECONNREFUSED localhost:3000` in Electron | Rails is not running. Run `bin/rails server` in a separate terminal. |
| `Schema.rb doesn't exist` | Run `bin/rails db:migrate`. |
| RuboCop `Style/StringLiterals` errors | Run `bundle exec rubocop -a` to auto-fix. |
| Binstub error `Beginning in Rails 4...` | Run `bundle exec rails app:update:bin --force`. |
| Fonts not loading in Electron | Add CSP meta tag to `index.html` allowing `fonts.googleapis.com`. |
| `api_news_index_url` undefined in tests | Delete the auto-generated controller test files for namespaced API controllers. |

---

## 🤖 AI Coding Assistants Used

This project was built with assistance from the following AI tools:

| Tool          | Usage                                                                 |
|---------------|-----------------------------------------------------------------------|
| **Perplexity AI** | Architecture design, full UI code generation, Rails API design, CI configuration, debugging, README authoring |
| **GitHub Copilot** | Inline code suggestions inside RubyMine during development      |

All AI-generated code was reviewed, tested, and adapted by the developer before committing.

---

## 📄 License

MIT License

Copyright (c) 2026 FrierenAnimeArchive Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🌿 Acknowledgements

- [Frieren: Beyond Journey's End](https://en.wikipedia.org/wiki/Frieren) by Kanehito Yamada & Tsukasa Abe — for the beautiful world and aesthetic that inspired this app
- [Jikan API](https://jikan.moe/) — unofficial MyAnimeList REST API, free and open
- [DuckDuckGo Instant Answer API](https://duckduckgo.com/api) — privacy-focused search, no key required
- [Electron](https://www.electronjs.org/) — cross-platform desktop apps with web technologies
- [Ruby on Rails](https://rubyonrails.org/) — the backend framework powering the API
- [Cinzel](https://fonts.google.com/specimen/Cinzel) — Google Font used for the ancient-world heading aesthetic
- [Inter](https://fonts.google.com/specimen/Inter) — Google Font used for clean body text
- [electron-builder](https://www.electron.build/) — packaging and distribution for Windows
- [RubyMine](https://www.jetbrains.com/ruby/) — IDE used throughout development
- [Perplexity AI](https://www.perplexity.ai/) — AI assistant used for architecture, UI design, and debugging during development
