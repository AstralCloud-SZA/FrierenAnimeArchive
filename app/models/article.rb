class Article < ApplicationRecord
  validates :title, :url, presence: true
  validates :url, uniqueness: true

  scope :recent, -> { order(published_at: :desc).limit(25) }
  scope :featured, -> { where(featured: true).limit(5) }
end
