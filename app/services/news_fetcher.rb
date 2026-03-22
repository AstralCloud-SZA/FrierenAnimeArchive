# app/services/news_fetcher.rb
require 'feedjira'
require 'faraday'

class NewsFetcher
  ANN_RSS   = 'https://www.animenewsnetwork.com/all/rss.xml'.freeze
  SOURCES   = {
    'ANN'   => 'https://www.animenewsnetwork.com/all/rss.xml',
    'Jikan' => 'https://api.jikan.moe/v4/watch/episodes'   # bonus source
  }.freeze

  # ── Main refresh — call from controller or job ────────
  def self.refresh
    Rails.logger.info "🌿 NewsFetcher: starting refresh..."
    fetch_ann
    Rails.logger.info "✅ NewsFetcher: #{Article.count} total articles in archive"
  rescue => e
    Rails.logger.error "NewsFetcher.refresh failed: #{e.message}"
  end

  private

  # ── ANN RSS ───────────────────────────────────────────
  def self.fetch_ann
    Rails.logger.info "📡 Fetching ANN RSS..."

    response = Faraday.get(ANN_RSS)
    unless response.success?
      Rails.logger.error "ANN RSS failed: HTTP #{response.status}"
      return
    end

    feed    = Feedjira.parse(response.body)
    saved   = 0
    skipped = 0

    feed.entries.first(20).each do |entry|
      next if entry.url.blank? || entry.title.blank?

      # find_or_create_by → skip duplicates by URL
      created = Article.find_or_create_by(url: entry.url.strip) do |article|
        article.title        = entry.title.truncate(255)
        article.summary      = clean_html(entry.summary || entry.content || '')
        article.source_name  = 'ANN'
        article.image_url    = extract_image(entry)
        article.published_at = entry.published || Time.current
        article.featured     = false
        saved += 1
      end

      skipped += 1 unless created.previously_new_record?
    end

    Rails.logger.info "ANN: #{saved} saved, #{skipped} skipped (duplicates)"
  rescue => e
    Rails.logger.error "fetch_ann error: #{e.message}"
  end

  # ── Strip HTML tags from summaries ───────────────────
  def self.clean_html(html)
    ActionController::Base.helpers.strip_tags(html).gsub(/\s+/, ' ').strip.truncate(300)
  rescue
    html.to_s.truncate(300)
  end

  # ── Try multiple image sources from feed entry ────────
  def self.extract_image(entry)
    entry.try(:image)             ||
      entry.try(:enclosure)&.url    ||
      entry.try(:itunes_image)      ||
      nil
  end
end
