# app/controllers/api/news_controller.rb
module Api
  class NewsController < ApplicationController
    def index
      # Stub data until Article model is built
      news = [
        {
          id: 1,
          title: "Jikan v4 API now stable",
          source_name: "Jikan News",
          summary: "The unofficial MyAnimeList API has reached stable status.",
          published_at: 3.days.ago,
          url: "https://jikan.moe"
        },
        {
          id: 2,
          title: "Rails 8.1 released",
          source_name: "Ruby News",
          summary: "Latest Rails with improved API mode and performance.",
          published_at: 1.week.ago,
          url: "https://rubyonrails.org"
        }
      ]
      render json: news
    end

    def show
      render json: { error: 'Not implemented yet' }, status: :not_found
    end
  end
end
