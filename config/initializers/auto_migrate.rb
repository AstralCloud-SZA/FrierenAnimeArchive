# config/initializers/auto_migrate.rb
# ─────────────────────────────────────────────────────────
# Creates and migrates only the current environment's
# databases at boot. Avoids create_all which incorrectly
# touches development/test databases even in production.
# Safe to run on every boot — idempotent.
# ─────────────────────────────────────────────────────────
if Rails.env.production?
  begin
    Rails.logger.info "⏳ Ensuring production databases exist..."

    ActiveRecord::Base.configurations.configs_for(env_name: 'production').each do |db_config|
      # Create the database file if it does not exist yet
      ActiveRecord::Tasks::DatabaseTasks.create(db_config)

      # Run any pending migrations for this database
      ActiveRecord::Tasks::DatabaseTasks.migrate_status
      ActiveRecord::Base.establish_connection(db_config.name.to_sym)
      ActiveRecord::MigrationContext.new(ActiveRecord::Tasks::DatabaseTasks.migrations_paths, ActiveRecord::Base.connection.schema_migration).migrate

      Rails.logger.info "✅ #{db_config.name} ready."
    end

    ActiveRecord::Base.establish_connection(:primary)

  rescue => e
    Rails.logger.error "❌ Auto-migrate failed: #{e.message}"
    raise
  end
end