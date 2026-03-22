# app/controllers/api/health_controller.rb
module Api
  class HealthController < ApplicationController
    def index
      render json: {
        status: "ok",
        timestamp: Time.current.iso8601,
        version: "v0.1.0",
        rails: Rails.version,
        env: Rails.env,
        apis: {
          jikan: jikan_available?,
          ddg: true
        }
      }, status: :ok
    end

    private

    def jikan_available?
      JikanClient.ping
    rescue StandardError
      false
    end
  end
end
