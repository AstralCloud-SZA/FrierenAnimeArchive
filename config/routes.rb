Rails.application.routes.draw do
  namespace :api do
    get "health", to: "health#index"
    get "news",   to: "news#index"
  end
end
