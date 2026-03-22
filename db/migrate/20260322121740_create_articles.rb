class CreateArticles < ActiveRecord::Migration[8.1]
  def change
    create_table :articles do |t|
      t.string   :title,        null: false
      t.text     :summary
      t.string   :source_name,  null: false, default: 'ANN'
      t.string   :url,          null: false
      t.string   :image_url
      t.datetime :published_at
      t.boolean  :featured,     null: false, default: false

      t.timestamps
    end

    add_index :articles, :url,          unique: true
    add_index :articles, :published_at
    add_index :articles, :source_name
  end
end
