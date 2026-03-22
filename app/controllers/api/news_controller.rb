# app/controllers/api/news_controller.rb
module Api
  class NewsController < ApplicationController
    def index
      # Auto-refresh from ANN RSS if archive is empty
      NewsFetcher.refresh if Article.count < 5

      articles = Article.order(published_at: :desc).limit(20)
      render json: articles.as_json(
        only: [ :id, :title, :summary, :source_name, :url, :image_url, :published_at ]
      )
    rescue => e
      Rails.logger.error "News index error: #{e.message}"
      render json: stub_news
    end

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

    private

    # Fallback stub if DB/RSS not ready yet
    def stub_news
      [
        {
          id: 1,
          title: "Jikan v4 API now stable",
          source_name: "Jikan",
          summary: "The unofficial MyAnimeList API has reached stable status.",
          published_at: 3.days.ago,
          url: "https://jikan.moe",
          image_url: nil
        },
        {
          id: 2,
          title: "Frieren S2 in production",
          source_name: "ANN",
          summary: "Madhouse confirms second season of Sousou no Frieren is underway.",
          published_at: 1.day.ago,
          url: "https://animenewsnetwork.com",
          image_url: nil
        },
        {
          id: 3,
          title: "Rails 8.1 released",
          source_name: "Ruby on Rails",
          summary: "Latest Rails ships with Solid Queue, Solid Cache and improved API mode.",
          published_at: 1.week.ago,
          url: "https://rubyonrails.org",
          image_url: nil
        }
      ]
    end
  end
end
