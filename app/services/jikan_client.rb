# app/services/jikan_client.rb
#
# ═══════════════════════════════════════════════════════════
#  JikanClient — Anime API client
#
#  PRIMARY:  Tenrai (https://api.tenrai.org/v1)
#  FALLBACK: Jikan  (https://api.jikan.moe/v4)
#
#  KEY ARCHITECTURE NOTE:
#  Faraday base URL joining breaks when BASE_URL contains a
#  path segment (/v1 or /v4). Solution: pass full absolute
#  URLs in every request and initialise Faraday with NO
#  url: option.
#
#  Windows SSL Note:
#  ssl[:verify] = false is required on Windows dev machines
#  due to missing CA cert bundle. Remove for production.
# ═══════════════════════════════════════════════════════════

require "faraday"
require "faraday/retry"
require "cgi"
require "json"

class JikanClient
  BASE_URL     = "https://api.tenrai.org/v1".freeze
  FALLBACK_URL = "https://api.jikan.moe/v4".freeze
  USER_AGENT   = "FrierenArchive/0.1.0".freeze

  @connection = nil

  def self.connection
    @connection ||= Faraday.new do |f|
      f.headers["User-Agent"] = USER_AGENT
      f.headers["Accept"]     = "application/json"

      # Windows dev SSL fix — remove in production
      f.ssl[:verify] = false

      f.options.timeout      = 15
      f.options.open_timeout = 8

      f.request :retry, {
        max: 3,
        interval: 1.0,
        interval_randomness: 0.5,
        backoff_factor: 2,
        retry_statuses: [429, 500, 503, 504]
      }
    end
  end

  # Tries Tenrai first using `path` (e.g. "/anime?q=dragon").
  # On failure, retries the exact same path against Jikan.
  # Returns parsed JSON Hash, or nil if both providers fail.
  def self.request_with_fallback(path)
    resp = connection.get("#{BASE_URL}#{path}")
    return JSON.parse(resp.body) if resp.success?

    Rails.logger.warn "Tenrai HTTP #{resp.status} for #{path} — trying Jikan fallback"
  rescue => e
    Rails.logger.warn "Tenrai request failed (#{e.message}) for #{path} — trying Jikan fallback"
  ensure
    unless defined?(resp) && resp&.success?
      begin
        fallback_resp = connection.get("#{FALLBACK_URL}#{path}")
        return JSON.parse(fallback_resp.body) if fallback_resp.success?

        Rails.logger.error "Jikan fallback HTTP #{fallback_resp.status} for #{path}"
      rescue => e2
        Rails.logger.error "Jikan fallback failed (#{e2.message}) for #{path}"
      end
    end
  end

  def self.ping
    !!request_with_fallback("/anime?q=test&limit=1")
  rescue => e
    Rails.logger.error "Anime API ping failed: #{e.message}"
    false
  end

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
    Rails.logger.error "search_anime failed: #{e.message}"
    []
  end

  def self.anime_details(mal_id)
    result = request_with_fallback("/anime/#{mal_id}")
    result&.dig("data") || {}
  rescue => e
    Rails.logger.error "anime_details failed: #{e.message}"
    {}
  end

  def self.top_anime(limit = 10)
    result = request_with_fallback("/top/anime?limit=#{limit}")
    result&.dig("data") || []
  rescue => e
    Rails.logger.error "top_anime failed: #{e.message}"
    []
  end

  def self.seasonal(year = Time.current.year, season = current_season)
    result = request_with_fallback("/seasons/#{year}/#{season}")
    result&.dig("data") || []
  rescue => e
    Rails.logger.error "seasonal failed: #{e.message}"
    []
  end

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