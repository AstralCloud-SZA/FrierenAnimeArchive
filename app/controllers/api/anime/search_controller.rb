# app/controllers/api/anime/search_controller.rb
module Api
  module Anime
    class SearchController < ApplicationController
      def index
        query = params[:q]&.strip
        if query.blank?
          render json: { error: 'Query parameter "q" required' }, status: :bad_request
          return
        end

        results = JikanClient.search_anime(query, limit: 15)
        render json: results
      end
    end
  end
end
