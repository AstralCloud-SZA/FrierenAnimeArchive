# config/initializers/auto_migrate.rb
# ─────────────────────────────────────────────────────────
# In packaged Electron builds the SQLite database starts
# empty on every new install. This initializer runs any
# pending migrations automatically at boot so the app
# never crashes with "no such table" on first launch.
# Safe to run repeatedly — migrations are idempotent.
# ─────────────────────────────────────────────────────────
if Rails.env.production?
  begin
    ActiveRecord::Migration.check_all_pending!
  rescue ActiveRecord::PendingMigrationError
    Rails.logger.info "⏳ Running pending migrations..."
    ActiveRecord::MigrationContext.new(
      Rails.root.join("db/migrate"),
      ActiveRecord::SchemaMigration
    ).migrate
    Rails.logger.info "✅ Migrations complete."
  end
end