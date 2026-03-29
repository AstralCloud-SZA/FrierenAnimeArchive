# app/controllers/api/news_controller.rb
# ═══════════════════════════════════════════════════════════
#  News Controller
#  Responsibilities:
#    - index   : return cached articles (auto-seed if empty)
#    - refresh : wipe DB + re-fetch live from ANN RSS (POST)
#    - show    : single article by ID
#    - fetch_content : fetch + parse full article body via
#                      Readability for the in-app reader
# ═══════════════════════════════════════════════════════════

require 'open-uri'
require 'readability'

module Api
  class NewsController < ApplicationController

    # GET /api/news
    # Returns cached articles. Auto-seeds on first run only.
    # For a forced live refresh, use POST /api/news/refresh.
    def index
      if Article.none?
        NewsFetcher.refresh
      end

      articles = Article.order(published_at: :desc).limit(20)
      render json: articles.as_json(
        only: [ :id, :title, :summary, :source_name, :url, :image_url, :published_at ]
      )
    rescue => e
      Rails.logger.error "News index error: #{e.message}"
      render json: stub_news
    end

    # POST /api/news/refresh
    # Wipes the articles table and fetches a fresh batch from
    # ANN RSS. Called by the "Load News" button in the Electron
    # renderer — guarantees fresh content on every button press.
    def refresh
      Rails.logger.info "🗑  News refresh: wiping #{Article.count} articles"
      Article.delete_all

      NewsFetcher.refresh

      articles = Article.order(published_at: :desc).limit(20)
      Rails.logger.info "✅ News refresh complete: #{articles.count} articles loaded"

      render json: articles.as_json(
        only: [ :id, :title, :summary, :source_name, :url, :image_url, :published_at ]
      )
    rescue => e
      Rails.logger.error "News refresh error: #{e.message}"
      render json: { error: e.message }, status: :internal_server_error
    end

    # GET /api/news/:id
    def show
      article = Article.find(params[:id])
      render json: article.as_json(
        only: [ :id, :title, :summary, :source_name, :url, :image_url, :published_at ]
      )
    rescue ActiveRecord::RecordNotFound
      render json: { error: "Article not found" }, status: :not_found
    rescue => e
      Rails.logger.error "News show error: #{e.message}"
      render json: { error: e.message }, status: :internal_server_error
    end

    # GET /api/news/content?url=<encoded_url>
    # Fetches and parses the full article body using Readability.
    # Powers the in-app article reader in the Electron renderer.
    def fetch_content
      url = params[:url]
      return render json: { error: 'No URL provided' }, status: :bad_request if url.blank?

      html     = URI.open(url, 'User-Agent' => 'Mozilla/5.0').read
      document = Readability::Document.new(html,
                                           tags:                %w[div p h1 h2 h3 h4 h5 h6 ul ol li blockquote img a b i em strong br],
                                           remove_empty_nodes:  true,
                                           attributes:          %w[src href alt title]
      )

      render json: { title: document.title, content: document.content }
    rescue => e
      Rails.logger.error "fetch_content error: #{e.message}"
      render json: { error: e.message }, status: :internal_server_error
    end

    private

    def stub_news
      [
        { id: 1, title: "Jikan v4 API now stable", source_name: "Jikan",
          summary: "The unofficial MyAnimeList API has reached stable status.",
          published_at: 3.days.ago, url: "https://jikan.moe", image_url: nil },
        { id: 2, title: "Frieren S2 in production", source_name: "ANN",
          summary: "Madhouse confirms second season of Sousou no Frieren is underway.",
          published_at: 1.day.ago, url: "https://animenewsnetwork.com", image_url: nil },
        { id: 3, title: "Rails 8.1 released", source_name: "Ruby on Rails",
          summary: "Latest Rails ships with Solid Queue, Solid Cache and improved API mode.",
          published_at: 1.week.ago, url: "https://rubyonrails.org", image_url: nil }
      ]
    end

  end
end