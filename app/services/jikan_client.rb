# app/services/jikan_client.rb
require 'faraday'

class JikanClient
  BASE_URL  = 'https://api.jikan.moe/v4'.freeze
  USER_AGENT = 'FrierenArchive/0.1.0 (contact@frierenarchive.com)'.freeze

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
    # NOTE: params passed as 2nd arg directly, NOT as params: keyword
    result = get('/anime', { q: query, limit: limit })
    result&.dig('data') || []
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

  # ── Private HTTP layer ────────────────────────────────
  private

  def self.get(path, params = {})
    conn = Faraday.new(
      url: BASE_URL,
      headers: { 'User-Agent' => USER_AGENT },
      request: { timeout: 10, open_timeout: 5 }
    )
    resp = conn.get(path, params)
    return nil unless resp.success?

    JSON.parse(resp.body)
  rescue JSON::ParserError, Faraday::Error => e
    Rails.logger.error "Jikan #{path}: #{e.message}"
    nil
  end
end
