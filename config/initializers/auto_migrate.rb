# config/initializers/auto_migrate.rb
# ─────────────────────────────────────────────────────────
# Creates and migrates only production databases at boot.
# Handles Rails 8 multi-db (primary, cache, queue, cable).
# Safe to run on every boot — fully idempotent.
# ─────────────────────────────────────────────────────────
if Rails.env.production?
  begin
    Rails.logger.info "⏳ Ensuring production databases exist..."

    ActiveRecord::Base.configurations.configs_for(env_name: 'production').each do |db_config|
      # 1. Create the SQLite file if it doesn't exist yet
      ActiveRecord::Tasks::DatabaseTasks.create(db_config)

      # 2. Run pending migrations for this specific database
      migrations_path = db_config.migrations_paths || 'db/migrate'
      ActiveRecord::MigrationContext.new(migrations_path).migrate

      Rails.logger.info "✅ #{db_config.name} ready."
    end

  rescue => e
    Rails.logger.error "❌ Auto-migrate failed: #{e.class} — #{e.message}"
    raise
  end
end