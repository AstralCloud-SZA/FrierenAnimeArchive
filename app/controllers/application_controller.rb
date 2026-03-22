# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  # Global error handling for JSON API
  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from Faraday::Error, with: :external_service_error

  private

  def not_found
    render json: { error: "Not found" }, status: :not_found
  end

  def external_service_error(error)
    Rails.logger.error "External API error: #{error.message}"
    render json: { error: "External service unavailable" }, status: :service_unavailable
  end
end
