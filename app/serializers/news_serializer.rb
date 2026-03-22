class NewsSerializer < ActiveModel::Serializer
  attributes :id, :title, :summary, :source_name, :published_at, :url, :image_url

  def published_at
    object.published_at.strftime('%Y-%m-%d') if object.published_at
  end
end
