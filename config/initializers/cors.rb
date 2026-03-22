# config/initializers/cors.rb — Your file + Electron protocol
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins do |origin|
      origin ||= request.headers["Origin"] || ""
      # Local dev + Electron + future prod
      origin.match?(/localhost/) ||
        origin.match?(/127\.0\.0\.1/) ||
        origin.start_with?("app://") ||  # Electron protocol
        origin.match?(/frieren-archive\.com/)
    end

    resource "/api/*",  # Only API routes, not everything
             headers: :any,
             methods: [ :get, :post, :options ],
             credentials: true,
             max_age: 3600
  end
end
