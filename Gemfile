source "https://rubygems.org"

gem "rails", "~> 8.1.2"
gem "sqlite3", "~> 2.1"   # used locally in development
# gem "pg", "~> 1.5"        # used in CI and production
gem "puma", ">= 5.0"

# ═══════════════════════════════════════════════════════════
# HTTP & APIs — Jikan + DuckDuckGo + ANN RSS
# ═══════════════════════════════════════════════════════════
gem "faraday", "~> 2.9"
gem "faraday-retry", "~> 2.2"
gem "feedjira", "~> 3.0"        # ANN RSS news feed
gem "http", "~> 5.2"            # HTTP client for NewsFetcher RSS fetch
gem 'ruby-readability'
gem 'nokogiri' # likely already present


# CORS — Electron dev + production
gem "rack-cors"

# Background jobs — Rails 8 native
gem "solid_queue"
gem "solid_cache"
gem "solid_cable"

# Environment (.env)
gem "dotenv-rails"

# ═══════════════════════════════════════════════════════════
# Rails 8 Production Stack
# ═══════════════════════════════════════════════════════════
gem "tzinfo-data", platforms: %i[ windows jruby ]
gem "bootsnap", require: false
gem "kamal", require: false
gem "thruster", require: false
gem "image_processing", "~> 1.2"

group :development, :test do
  gem "debug", platforms: %i[ mri windows ]
  gem "bundler-audit", require: false
  gem "brakeman", require: false
  gem "rubocop-rails-omakase", require: false
end
