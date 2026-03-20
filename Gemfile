# Gemfile
source "https://rubygems.org"

# Rails 8.1.2 — API-only mode (keep your existing Rails)
gem "rails", "~> 8.1.2"

# SQLite3 (your existing)
gem "sqlite3", ">= 2.1"

# Puma (your existing)
gem "puma", ">= 5.0"

# ═══════════════════════════════════════════════════════════
# FRIEREN ARCHIVE SPECIFIC — ADD THESE
# ═══════════════════════════════════════════════════════════

# HTTP clients for Jikan + DuckDuckGo APIs
gem "faraday"
gem "faraday-retry"

# JSON responses
gem "jbuilder"

# CORS for Electron frontend
gem "rack-cors"

# Background jobs (news refresh)
gem "sidekiq"

# Environment variables (.env)
gem "dotenv-rails"

# ═══════════════════════════════════════════════════════════
# KEEP YOUR EXISTING DEVELOPMENT GEMS — THEY'RE PERFECT
# ═══════════════════════════════════════════════════════════
gem "tzinfo-data", platforms: %i[ windows jruby ]
gem "solid_cache"
gem "solid_queue"
gem "solid_cable"
gem "bootsnap", require: false
gem "kamal", require: false
gem "thruster", require: false
gem "image_processing", "~> 1.2"

group :development, :test do
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"
  gem "bundler-audit", require: false
  gem "brakeman", require: false
  gem "rubocop-rails-omakase", require: false
end
