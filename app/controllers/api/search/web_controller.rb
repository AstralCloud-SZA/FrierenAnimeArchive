# app/controllers/api/search/web_controller.rb
module Api
  module Search
    class WebController < ApplicationController
      def index
        query = params[:q]&.strip
        if query.blank?
          render json: { error: 'Query parameter "q" required' }, status: :bad_request
          return
        end

        result = DuckDuckGoClient.search(query)
        render json: result
      end
    end
  end
end
