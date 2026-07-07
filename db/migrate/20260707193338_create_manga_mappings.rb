class CreateMangaMappings < ActiveRecord::Migration[8.1]
  def change
    create_table :manga_mappings do |t|
      t.integer :mal_id,     null: false
      t.string  :title,      null: false
      t.string  :manga_url,  null: false
      t.string  :source,     default: "mangadex"  # future-proof for multiple sites

      t.timestamps
    end

    add_index :manga_mappings, :mal_id, unique: true
  end
end
