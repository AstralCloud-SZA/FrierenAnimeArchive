# app/models/manga_mapping.rb
class MangaMapping < ApplicationRecord
  validates :mal_id, presence: true, uniqueness: true
  validates :title, :manga_url, presence: true
end