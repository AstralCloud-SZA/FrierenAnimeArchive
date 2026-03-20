module Api
  class HealthController < ApplicationController
    def index
      render json: {
        status: 'ok',
        rails_version: Rails.version,
        ruby_version: RUBY_VERSION,
        time: Time.current
      }
    end
  end
end
