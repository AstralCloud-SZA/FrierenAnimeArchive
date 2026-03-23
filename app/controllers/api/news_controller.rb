# app/controllers/api/news_controller.rb
require 'open-uri'
require 'nokogiri'
require 'readability'

module Api
  class NewsController < ApplicationController

    # ── Ordered most-specific → least — covers ANN, CR, MAL news, general blogs ──
    ARTICLE_SELECTORS = %w[
      .article-body
      .news-article-body
      [itemprop="articleBody"]
      .entry-content
      .post-content
      .article-content
      article .content
      #news-article-content
      #content-main article
      #content article
      main article
      article
    ].freeze

    def index
      NewsFetcher.refresh if Article.count < 5
      articles = Article.order(published_at: :desc).limit(20)
      render json: articles.as_json(
        only: %i[id title summary source_name url image_url published_at]
      )
    rescue => e
      Rails.logger.error "News index error: #{e.message}"
      render json: stub_news
    end

    def show
      article = Article.find(params[:id])
      render json: article.as_json(
        only: %i[id title summary source_name url image_url published_at]
      )
    rescue ActiveRecord::RecordNotFound
      render json: { error: 'Article not found' }, status: :not_found
    rescue => e
      Rails.logger.error "News show error: #{e.message}"
      render json: { error: e.message }, status: :internal_server_error
    end

    # ── Fetch and parse full article content ─────────────────────────────────
    def fetch_content
      url = params[:url]
      return render json: { error: 'No URL provided' }, status: :bad_request if url.blank?

      html     = URI.open(url, 'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36').read
      doc      = Nokogiri::HTML(html)
      base_uri = URI.parse(url)
      title    = doc.title&.strip || ''

      # ── Step 1: try known article body selectors ─────────────────────────
      content_node = ARTICLE_SELECTORS.lazy
                                      .map    { |sel| doc.at_css(sel) }
                                      .reject { |node| node.nil? || node.text.strip.length < 100 }
                                      .first

      content_html = if content_node
                       content_node.css(
                         'script, style, iframe, noscript, nav, header, footer,
                          .ad, .advertisement, .social-share, .sidebar,
                          .related-articles, .newsletter-signup, .comments'
                       ).each(&:remove)

                       content_node.inner_html
                     else
                       # ── Step 2: fall back to readability ──────────────────
                       Readability::Document.new(
                         html,
                         tags:               %w[div p h1 h2 h3 h4 h5 h6
                                                ul ol li blockquote
                                                img figure figcaption
                                                a b i em strong br span],
                         remove_empty_nodes: false,
                         attributes:         %w[src href alt title class id width height]
                       ).content
                     end

      # ── Step 3: post-process HTML — fix URLs + add referrerpolicy ────────
      fragment = Nokogiri::HTML.fragment(content_html)

      fragment.css('img').each do |img|
        src = img['src'].to_s.strip
        next if src.empty?

        img['src'] = begin
                       URI.join(base_uri, src).to_s
                     rescue URI::InvalidURIError
                       src
                     end

        img['referrerpolicy'] = 'no-referrer'
        img.delete('loading')
        img.delete('srcset')
      end

      fragment.css('a').each do |a|
        href = a['href'].to_s.strip
        next if href.empty? || href.start_with?('#', 'javascript:', 'mailto:')
        a['href'] = begin
                      URI.join(base_uri, href).to_s
                    rescue URI::InvalidURIError
                      href
                    end
      end

      render json: { title: title, content: fragment.to_html }

    rescue OpenURI::HTTPError => e
      Rails.logger.error "fetch_content HTTP error #{url}: #{e.message}"
      render json: { error: "Could not fetch article (#{e.message})" }, status: :bad_gateway
    rescue => e
      Rails.logger.error "fetch_content error #{url}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
      render json: { error: e.message }, status: :internal_server_error
    end

    private

    def stub_news
      [
        { id: 1, title: 'Jikan v4 API now stable', source_name: 'Jikan',
          summary: 'The unofficial MyAnimeList API has reached stable status.',
          published_at: 3.days.ago, url: 'https://jikan.moe', image_url: nil },
        { id: 2, title: 'Frieren S2 in production', source_name: 'ANN',
          summary: 'Madhouse confirms second season of Sousou no Frieren is underway.',
          published_at: 1.day.ago, url: 'https://animenewsnetwork.com', image_url: nil },
        { id: 3, title: 'Rails 8.1 released', source_name: 'Ruby on Rails',
          summary: 'Latest Rails ships with Solid Queue, Solid Cache and improved API mode.',
          published_at: 1.week.ago, url: 'https://rubyonrails.org', image_url: nil }
      ]
    end
  end
end
