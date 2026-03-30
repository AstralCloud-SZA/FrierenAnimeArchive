module Api
  module Anime
    class SearchController < ApplicationController
      # GET /api/anime/search?q=frieren&sfw=true
      def index
        query = params[:q]&.strip
        return render json: { error: "Query required" }, status: :bad_request if query.blank?

        # sfw param comes from frontend settings toggle
        sfw = params[:sfw] == "true"

        results = JikanClient.search_anime(query, 15, sfw: sfw)
        render json: { data: results }
      rescue => e
        Rails.logger.error "Anime search error: #{e.message}"
        render json: { error: "Jikan unavailable", data: [] }, status: :service_unavailable
      end
    end
  end
end