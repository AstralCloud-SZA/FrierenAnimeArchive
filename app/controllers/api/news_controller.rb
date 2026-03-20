module Api
  class NewsController < ApplicationController
    def index
      render json: [
        {
          id: 1,
          title: "Frieren Archive prototype live!",
          summary: "Rails 8.1.2 API + Electron desktop app.",
          published_at: Time.current.iso8601
        },
        {
          id: 2,
          title: "Sample anime news item",
          summary: "This will be replaced with real Jikan/ANN data.",
          published_at: 1.hour.ago.iso8601
        }
      ]
    end
  end
end
