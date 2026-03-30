module Api
  module Anime
    class AnimeController < ApplicationController
      def search
        query = params[:q]&.strip
        return render json: { error: "Query required" }, status: :bad_request unless query

        result = JikanClient.search_anime(query, 15)
        render json: result
      end
    end
  end
end