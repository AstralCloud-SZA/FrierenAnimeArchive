class Api::AnimeController < ApplicationController
  def search
    query = params[:q]&.strip
    return render json: { error: "Query required" }, status: 400 unless query

    result = JikanClient.search_anime(query, 15)
    render json: result
  end
end
