module Api
  module Anime
    class ShowController < ApplicationController
      def show
        mal_id = params[:id]

        unless mal_id =~ /\A\d+\z/
          render json: { error: "mal_id must be a positive integer" }, status: :bad_request
          return
        end

        anime = JikanClient.anime_details(mal_id)

        if anime.nil? || anime.empty?
          render json: { error: "Anime not found" }, status: :not_found
        else
          render json: anime
        end
      rescue => e
        Rails.logger.error "Anime show error: #{e.message}"
        render json: { error: "Jikan unavailable" }, status: :service_unavailable
      end
    end
  end
end