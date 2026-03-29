# config/routes.rb
Rails.application.routes.draw do
  get "search/index"

  namespace :api do
    # Health check
    get "health", to: "health#index"

    # News
    # ⚠️  collection routes (content, refresh) must be declared
    #     before resources so they are never matched as :id params.
    resources :news, only: [ :index, :show ] do
      collection do
        get  "content", to: "news#fetch_content"  # GET  /api/news/content?url=…
        post "refresh", to: "news#refresh"         # POST /api/news/refresh
      end
    end

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
      get "connect",  to: "oauth#connect"
      get "callback", to: "oauth#callback"
      get "me",       to: "users#me"
    end
  end
end