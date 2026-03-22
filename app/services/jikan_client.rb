# app/services/jikan_client.rb
require 'faraday'
require 'faraday/retry'

class JikanClient
  BASE_URL   = 'https://api.jikan.moe/v4'.freeze
  USER_AGENT = 'FrierenArchive/0.1.0 (contact@frierenarchive.com)'.freeze

  # ── Reusable connection with retry + timeout ──────────
  def self.connection
    @connection ||= Faraday.new(url: BASE_URL) do |f|
      f.headers['User-Agent'] = USER_AGENT
      f.headers['Accept']     = 'application/json'

      # Auto-retry on network errors + 429 rate limit
      f.request :retry, {
        max:                 3,
        interval:            0.5,
        interval_randomness: 0.5,
        backoff_factor:      2,
        retry_statuses:      [429, 500, 503]
      }

      f.options.timeout      = 15
      f.options.open_timeout = 8
    end
  end

  # ── Health ping ───────────────────────────────────────
  def self.ping
    result = get('/meta/status')
    result&.dig('status') == 200
  rescue => e
    Rails.logger.error "Jikan ping failed: #{e.message}"
    false
  end

  # ── Search anime ──────────────────────────────────────
  def self.search_anime(query, limit = 15)
    return [] if query.blank?

    result = get('/anime', q: query.strip, limit: limit, sfw: true)
    data   = result&.dig('data') || []

    Rails.logger.info "Jikan search '#{query}': #{data.size} results"
    data
  rescue => e
    Rails.logger.error "Jikan search failed: #{e.message}"
    []
  end

  # ── Anime details by MAL ID ───────────────────────────
  def self.anime_details(mal_id)
    result = get("/anime/#{mal_id}")
    result&.dig('data') || {}
  rescue => e
    Rails.logger.error "Jikan details failed: #{e.message}"
    {}
  end

  # ── Top anime (bonus — for future homepage widget) ────
  def self.top_anime(limit = 10)
    result = get('/top/anime', limit: limit)
    result&.dig('data') || []
  rescue => e
    Rails.logger.error "Jikan top anime failed: #{e.message}"
    []
  end

  # ── Seasonal anime ────────────────────────────────────
  def self.seasonal(year = Time.current.year, season = current_season)
    result = get("/seasons/#{year}/#{season}")
    result&.dig('data') || []
  rescue => e
    Rails.logger.error "Jikan seasonal failed: #{e.message}"
    []
  end

  private

  def self.get(path, params = {})
    resp = connection.get(path, params)

    unless resp.success?
      Rails.logger.warn "Jikan #{path} → HTTP #{resp.status}"
      return nil
    end

    JSON.parse(resp.body)
  rescue JSON::ParserError, Faraday::Error => e
    Rails.logger.error "Jikan #{path}: #{e.message}"
    nil
  end

  def self.current_season
    case Time.current.month
    when 1..3  then 'winter'
    when 4..6  then 'spring'
    when 7..9  then 'summer'
    else            'fall'
    end
  end
end
