# config/routes.rb
Rails.application.routes.draw do
  get "search/index"
  # API namespace
  namespace :api do
    # Health check
    get "health", to: "health#index"

    # News
    resources :news, only: [ :index, :show ]

    # Anime (Jikan proxy)
    namespace :anime do
      get "search", to: "search#index"
      get ":id",    to: "show#show"
    end

    # DuckDuckGo Instant Answer
    namespace :search do
      get "web", to: "web#index"
    end

    # Future: MAL OAuth
    namespace :mal do
      get "connect", to: "oauth#connect"
      get "callback", to: "oauth#callback"
      get "me",       to: "users#me"
    end
  end
end
