# config/initializers/auto_migrate.rb
# ─────────────────────────────────────────────────────────
# In packaged Electron builds the SQLite databases start
# empty on every new install. This initializer creates all
# configured databases and runs any pending migrations at
# boot so the app never crashes with "no such table".
#
# Uses DatabaseTasks which is the correct Rails 8.x API —
# handles all four databases (primary, cache, queue, cable)
# in a single call and is safe to run on every boot.
# ─────────────────────────────────────────────────────────
if Rails.env.production?
  begin
    Rails.logger.info "⏳ Ensuring databases exist..."
    ActiveRecord::Tasks::DatabaseTasks.create_all

    Rails.logger.info "⏳ Running pending migrations..."
    ActiveRecord::Tasks::DatabaseTasks.migrate

    Rails.logger.info "✅ Database setup complete."
  rescue => e
    Rails.logger.error "❌ Auto-migrate failed: #{e.message}"
    raise  # re-raise so Rails exits cleanly rather than booting broken
  end
end