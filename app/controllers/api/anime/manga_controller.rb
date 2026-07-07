# app/controllers/api/anime/manga_controller.rb
module Api
  module Anime
    class MangaController < ApplicationController
      # GET /api/anime/manga?q=frieren
      # GET /api/anime/manga?mal_id=52991
      def index
        query  = params[:q]&.strip
        mal_id = params[:mal_id]

        if mal_id.present? && mal_id !~ /\A\d+\z/
          return render json: { error: "mal_id must be a positive integer" }, status: :bad_request
        end

        if query.blank? && mal_id.blank?
          return render json: { error: "q or mal_id required" }, status: :bad_request
        end

        url = mal_id.present? ? MangaLinkService.url_for_mal_id(mal_id) : nil
        url ||= MangaLinkService.search_url(query) if query.present?

        if url.blank?
          render json: { error: "No manga link found" }, status: :not_found
        else
          render json: { data: { url: url } }
        end
      rescue => e
        Rails.logger.error "Manga link error: #{e.message}"
        render json: { error: "Manga service unavailable" }, status: :service_unavailable
      end
    end
  end
end