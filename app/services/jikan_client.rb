# app/services/jikan_client.rb
#
# ═══════════════════════════════════════════════════════════
#  JikanClient — Unofficial MyAnimeList API (Jikan v4)
#  https://api.jikan.moe/v4
#
#  KEY ARCHITECTURE NOTE:
#  Faraday base URL joining breaks when BASE_URL contains a
#  path segment (/v4). Solution: pass full absolute URLs in
#  every request and initialise Faraday with NO url: option.
#
#  Windows SSL Note:
#  ssl[:verify] = false is required on Windows dev machines
#  due to missing CA cert bundle. Remove for production.
# ═══════════════════════════════════════════════════════════

require "faraday"
require "faraday/retry"
require "cgi"

class JikanClient
  BASE_URL   = "https://api.jikan.moe/v4".freeze
  USER_AGENT = "FrierenArchive/0.1.0".freeze

  # Reset on class reload (important in Rails dev mode)
  @connection = nil

  # ── Persistent connection ──────────────────────────────
  # Builds a reusable Faraday connection with:
  #   - JSON accept header
  #   - Windows SSL bypass (dev only)
  #   - Auto-retry on rate limits (429) and server errors
  #   - 15s timeout to handle slow Jikan responses
  def self.connection
    @connection ||= Faraday.new do |f|
      f.headers["User-Agent"] = USER_AGENT
      f.headers["Accept"]     = "application/json"

      # Windows dev SSL fix — remove in production
      f.ssl[:verify] = false

      f.options.timeout      = 15   # read timeout (seconds)
      f.options.open_timeout = 8    # connection timeout

      # Retry on transient errors + Jikan rate limiting (429)
      f.request :retry, {
        max:                 3,
        interval:            1.0,
        interval_randomness: 0.5,
        backoff_factor:      2,
        retry_statuses:      [ 429, 500, 503 ]
      }
    end
  end

  # ── ping ───────────────────────────────────────────────
  # Quick liveness check used by HealthController.
  # Hits /anime with a minimal query rather than /meta/status
  # because /meta/status returns 404 on some Jikan nodes.
  #
  # Returns: Boolean — true if Jikan is reachable
  def self.ping
    resp = connection.get("#{BASE_URL}/anime?q=test&limit=1")
    resp.success?
  rescue => e
    Rails.logger.error "Jikan ping failed: #{e.message}"
    false
  end

  # ── search_anime ───────────────────────────────────────────
  # Params:
  #   query  String  — search term e.g. "frieren"
  #   limit  Integer — max results (1–25)
  #   sfw    Boolean — safe-for-work filter (default false,
  #                    toggled from Settings page)
  #
  # Example:
  #   JikanClient.search_anime('frieren', 15, sfw: false)
  def self.search_anime(query, limit = 15, sfw: false)
    return [] if query.blank?

    url = "#{BASE_URL}/anime?q=#{CGI.escape(query.strip)}&limit=#{limit}"
    url += "&sfw=true" if sfw   # only append if enabled

    resp = connection.get(url)

    unless resp.success?
      Rails.logger.warn "Jikan search HTTP #{resp.status} for '#{query}'"
      return []
    end

    data = JSON.parse(resp.body).dig("data") || []
    Rails.logger.info "Jikan search '#{query}': #{data.size} results (sfw: #{sfw})"
    data
  rescue => e
    Rails.logger.error "Jikan search_anime failed: #{e.message}"
    []
  end


  # ── anime_details ──────────────────────────────────────
  # Fetch full details for a single anime by MAL ID.
  # Used by the show endpoint /api/anime/:id
  #
  # Params:
  #   mal_id  Integer|String — MyAnimeList anime ID
  #
  # Returns: Hash of anime data, {} on error/not found
  #
  # Example:
  #   JikanClient.anime_details(52991)
  #   # => { "mal_id" => 52991, "title" => "Sousou no Frieren",
  #   #      "score" => 9.25, "episodes" => 28, ... }
  def self.anime_details(mal_id)
    resp = connection.get("#{BASE_URL}/anime/#{mal_id}")

    unless resp.success?
      Rails.logger.warn "Jikan details HTTP #{resp.status} for ID #{mal_id}"
      return {}
    end

    JSON.parse(resp.body).dig("data") || {}
  rescue => e
    Rails.logger.error "Jikan anime_details failed: #{e.message}"
    {}
  end

  # ── top_anime ──────────────────────────────────────────
  # Fetch the current MAL top-ranked anime list.
  # Useful for a homepage widget or "Trending" section.
  #
  # Params:
  #   limit  Integer — number of results (default 10, max 25)
  #
  # Returns: Array of anime hashes, [] on error
  #
  # Example:
  #   JikanClient.top_anime(5)
  #   # => [{ "rank" => 1, "title" => "Fullmetal Alchemist...", ... }]
  def self.top_anime(limit = 10)
    resp = connection.get("#{BASE_URL}/top/anime?limit=#{limit}")

    unless resp.success?
      Rails.logger.warn "Jikan top_anime HTTP #{resp.status}"
      return []
    end

    JSON.parse(resp.body).dig("data") || []
  rescue => e
    Rails.logger.error "Jikan top_anime failed: #{e.message}"
    []
  end

  # ── seasonal ───────────────────────────────────────────
  # Fetch anime airing in a specific season.
  # Defaults to the current calendar season automatically.
  #
  # Params:
  #   year    Integer — e.g. 2026
  #   season  String  — "winter" | "spring" | "summer" | "fall"
  #
  # Returns: Array of anime hashes, [] on error
  #
  # Example:
  #   JikanClient.seasonal         # current season
  #   JikanClient.seasonal(2026, 'spring')
  def self.seasonal(year = Time.current.year, season = current_season)
    resp = connection.get("#{BASE_URL}/seasons/#{year}/#{season}")

    unless resp.success?
      Rails.logger.warn "Jikan seasonal HTTP #{resp.status}"
      return []
    end

    JSON.parse(resp.body).dig("data") || []
  rescue => e
    Rails.logger.error "Jikan seasonal failed: #{e.message}"
    []
  end

  # ── Private helpers ───────────────────────────────────
  private

  # Derives the current anime season from the calendar month.
  # Winter: Jan–Mar | Spring: Apr–Jun | Summer: Jul–Sep | Fall: Oct–Dec
  def self.current_season
    case Time.current.month
    when 1..3  then "winter"
    when 4..6  then "spring"
    when 7..9  then "summer"
    else            "fall"
    end
  end
end
