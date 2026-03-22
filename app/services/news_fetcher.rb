require 'feedjira'

class NewsFetcher
  ANN_RSS = 'https://www.animenewsnetwork.com/all/rss.xml'

  def self.refresh
    feed = Feedjira.parse(HTTP.get(ANN_RSS))

    feed.entries.each do |entry|
      Article.create_or_find_by(url: entry.url) do |article|
        article.title = entry.title
        article.summary = entry.summary&.truncate(200)
        article.source_name = 'ANN'
        article.url = entry.url
        article.image_url = entry.image || entry.enclosure&.url
        article.published_at = entry.published
      end
    end
  end
end
