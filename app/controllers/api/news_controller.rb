# app/controllers/api/news_controller.rb
module Api
  class NewsController < ApplicationController
    def index
      # Auto-refresh from ANN RSS (real news!)
      NewsFetcher.refresh if Article.count < 5  # Only on first loads

      articles = Article.recent
      render json: articles, each_serializer: NewsSerializer
    end

    def show
      article = Article.find(params[:id])
      render json: article, serializer: NewsSerializer
    rescue ActiveRecord::RecordNotFound
      render json: { error: 'Article not found' }, status: :not_found
    end
  end
end
