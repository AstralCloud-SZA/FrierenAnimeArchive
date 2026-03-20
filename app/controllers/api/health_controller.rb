# app/controllers/api/health_controller.rb
module Api
  class HealthController < ApplicationController
    def index
      render json: {
        status: 'ok',
        timestamp: Time.current.iso8601,
        uptime: Time.now - Rails.server.start_time,
        version: 'v0.1.0',
        apis: {
          jikan: jikan_available?,
          ddg: true  # always available
        }
      }, status: :ok
    end

    private

    def jikan_available?
      JikanClient.ping rescue false
    end
  end
end
