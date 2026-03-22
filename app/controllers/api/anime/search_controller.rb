module Api
  module Anime
    class SearchController < ApplicationController
      def index
        query = params[:q]&.strip
        return render json: { error: 'Query required' }, status: :bad_request if query.blank?

        # search_anime returns array directly now
        results = JikanClient.search_anime(query, 15)
        render json: { data: results }
      rescue => e
        Rails.logger.error "Anime search error: #{e.message}"
        render json: { error: 'Jikan unavailable', data: [] }, status: :service_unavailable
      end
    end
  end
end
