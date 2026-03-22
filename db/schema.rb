# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_03_22_121740) do
  create_table "articles", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.boolean "featured", default: false, null: false
    t.string "image_url"
    t.datetime "published_at"
    t.string "source_name", default: "ANN", null: false
    t.text "summary"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.string "url", null: false
    t.index ["published_at"], name: "index_articles_on_published_at"
    t.index ["source_name"], name: "index_articles_on_source_name"
    t.index ["url"], name: "index_articles_on_url", unique: true
  end
end
