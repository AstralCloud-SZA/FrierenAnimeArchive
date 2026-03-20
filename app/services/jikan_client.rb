# app/services/jikan_client.rb
require 'faraday'

class JikanClient
  BASE_URL = 'https://api.jikan.moe/v4'
  USER_AGENT = 'FrierenArchive/0.1.0 (contact@frierenarchive.com)'

  def self.ping
    get('/meta')['status'] == 200
  rescue => e
    Rails.logger.error "Jikan ping failed: #{e.message}"
    false
  end

  def self.search_anime(query, limit: 10)
    get("/anime", params: { q: query, limit: limit })['data'] || []
  end

  def self.anime_details(mal_id)
    get("/anime/#{mal_id}") || {}
  rescue
    {}
  end

  private

  def self.get(path, params: {})
    conn = Faraday.new(url: BASE_URL, headers: { 'User-Agent' => USER_AGENT })
    resp = conn.get(path, params)
    return nil unless resp.success?

    JSON.parse(resp.body)
  rescue JSON::ParserError, Faraday::Error => e
    Rails.logger.error "Jikan #{path}: #{e.message}"
    nil
  end
end
