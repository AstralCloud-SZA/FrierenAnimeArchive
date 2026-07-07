# app/services/manga_link_service.rb
class MangaLinkService
  BASE_URL = "https://mangadex.org"

  def self.search_url(title)
    "#{BASE_URL}/search?q=#{CGI.escape(title)}"
  end

  # Later: map MAL id -> exact series page once you store it in DB
  def self.url_for_mal_id(mal_id)
    MangaMapping.find_by(mal_id: mal_id)&.manga_url
  end
end