# app/services/duck_duck_go_client.rb
require 'faraday'

class DuckDuckGoClient
  BASE_URL = 'https://api.duckduckgo.com'
  FORMAT   = 'json'

  def self.search(query)
    params = {
      q: query,
      format: FORMAT,
      no_html: 1,
      skip_disambig: 1
    }
    resp = Faraday.get(BASE_URL, params)
    return {} unless resp.success?

    JSON.parse(resp.body).symbolize_keys
  rescue JSON::ParserError, Faraday::Error => e
    Rails.logger.error "DDG #{query}: #{e.message}"
    {}
  end
end
