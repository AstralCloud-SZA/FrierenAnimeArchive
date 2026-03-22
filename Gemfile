source "https://rubygems.org"

gem "rails", "~> 8.1.2"
gem "sqlite3", ">= 2.1"
gem "puma", ">= 5.0"

# ═══════════════════════════════════════════════════════════
# HTTP & APIs — Jikan + DuckDuckGo + ANN RSS
# ═══════════════════════════════════════════════════════════
gem "faraday", "~> 2.9"
gem "faraday-retry", "~> 2.2"
gem "feedjira", "~> 3.0"        # ANN RSS news feed
gem "active_model_serializers"

# JSON API responses
gem "jbuilder"

# CORS — Electron dev + production
gem "rack-cors"

# Background jobs — auto-refresh news
gem "solid_queue"                # Rails 8 native (you have it!)

# Environment (.env)
gem "dotenv-rails"

# ═══════════════════════════════════════════════════════════
# Rails 8 Production Stack (KEEP ALL)
# ═══════════════════════════════════════════════════════════
gem "tzinfo-data", platforms: %i[ windows jruby ]
gem "solid_cache"
gem "solid_cable"
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

# Remove sidekiq — Solid Queue is better for Rails 8!
