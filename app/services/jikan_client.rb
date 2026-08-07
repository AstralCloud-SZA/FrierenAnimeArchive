# app/services/jikan_client.rb
#
# ═══════════════════════════════════════════════════════════
#  JikanClient — Unofficial MyAnimeList API (Jikan v4)
#  https://api.jikan.moe/v4
#
#  FALLBACK: Tenrai (https://api.tenrai.org/v1) — same Jikan v4
#  schema, used automatically when Jikan is unreachable/down.
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
  BASE_URL        = "https://api.jikan.moe/v4".freeze
  FALLBACK_URL    = "https://api.tenrai.org/v1".freeze
  USER_AGENT      = "FrierenArchive/0.1.0".freeze

  # Reset on class reload (important in Rails dev mode)
  @connection = nil

  # ── Persistent connection ──────────────────────────────
  def self.connection
    @connection ||= Faraday.new do |f|
      f.headers["User-Agent"] = USER_AGENT
      f.headers["Accept"]     = "application/json"

      # Windows dev SSL fix — remove in production
      f.ssl[:verify] = false

      f.options.timeout      = 15   # read timeout (seconds)
      f.options.open_timeout = 8    # connection timeout

      # Retry on transient errors + rate limiting (429) + 504
      f.request :retry, {
        max:                 3,
        interval:            1.0,
        interval_randomness: 0.5,
        backoff_factor:      2,
        retry_statuses:      [ 429, 500, 503, 504 ]
      }
    end
  end

  # ── request_with_fallback ──────────────────────────────
  # Tries Jikan first using `path` (e.g. "/anime?q=dragon").
  # On any failure (non-2xx or exception), retries the exact
  # same path against Tenrai before giving up.
  #
  # Returns: parsed JSON Hash, or nil if both providers fail
  def self.request_with_fallback(path)
    resp = connection.get("#{BASE_URL}#{path}")
    return JSON.parse(resp.body) if resp.success?

    Rails.logger.warn "Jikan HTTP #{resp.status} for #{path} — trying Tenrai fallback"
  rescue => e
    Rails.logger.warn "Jikan request failed (#{e.message}) for #{path} — trying Tenrai fallback"
  ensure
    unless defined?(resp) && resp&.success?
      begin
        fallback_resp = connection.get("#{FALLBACK_URL}#{path}")
        return JSON.parse(fallback_resp.body) if fallback_resp.success?

        Rails.logger.error "Tenrai fallback HTTP #{fallback_resp.status} for #{path}"
      rescue => e2
        Rails.logger.error "Tenrai fallback failed (#{e2.message}) for #{path}"
      end
    end
  end

  # ── ping ───────────────────────────────────────────────
  def self.ping
    !!request_with_fallback("/anime?q=test&limit=1")
  rescue => e
    Rails.logger.error "Jikan ping failed: #{e.message}"
    false
  end

  # ── search_anime ───────────────────────────────────────────
  def self.search_anime(query, limit = 15, sfw: false)
    return [] if query.blank?

    path = "/anime?q=#{CGI.escape(query.strip)}&limit=#{limit}"
    path += "&sfw=true" if sfw

    result = request_with_fallback(path)
    return [] if result.nil?

    data = result.dig("data") || []
    Rails.logger.info "Anime search '#{query}': #{data.size} results (sfw: #{sfw})"
    data
  rescue => e
    Rails.logger.error "Jikan search_anime failed: #{e.message}"
    []
  end

  # ── anime_details ──────────────────────────────────────
  def self.anime_details(mal_id)
    result = request_with_fallback("/anime/#{mal_id}")
    result&.dig("data") || {}
  rescue => e
    Rails.logger.error "Jikan anime_details failed: #{e.message}"
    {}
  end

  # ── top_anime ──────────────────────────────────────────
  def self.top_anime(limit = 10)
    result = request_with_fallback("/top/anime?limit=#{limit}")
    result&.dig("data") || []
  rescue => e
    Rails.logger.error "Jikan top_anime failed: #{e.message}"
    []
  end

  # ── seasonal ───────────────────────────────────────────
  def self.seasonal(year = Time.current.year, season = current_season)
    result = request_with_fallback("/seasons/#{year}/#{season}")
    result&.dig("data") || []
  rescue => e
    Rails.logger.error "Jikan seasonal failed: #{e.message}"
    []
  end

  # ── Private helpers ───────────────────────────────────
  private

  def self.current_season
    case Time.current.month
    when 1..3  then "winter"
    when 4..6  then "spring"
    when 7..9  then "summer"
    else            "fall"
    end
  end
end