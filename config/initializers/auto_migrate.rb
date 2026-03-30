# config/initializers/auto_migrate.rb
# ═══════════════════════════════════════════════════════════════════════════
#  Auto-Migrate — Production Database Bootstrap
#
#  WHY THIS EXISTS
#  ───────────────
#  In a standard Rails deployment, a human runs `db:create` and `db:migrate`
#  before starting the server. In this Electron-packaged app, there is no
#  deployment step — the app boots directly on the end-user's machine where
#  the SQLite files may not exist yet (first launch) or may be behind on
#  migrations (after an update).
#
#  This initializer replaces that manual step by running create + migrate
#  automatically at boot, every time. Both operations are fully idempotent:
#    • DatabaseTasks.create  → no-ops if the file already exists
#    • MigrationContext.migrate → no-ops if schema_version is current
#
#  MULTI-DATABASE LAYOUT (Rails 8 three-tier config)
#  ──────────────────────────────────────────────────
#  This app uses four production databases, each mapped to a writable path
#  in the user's userData directory via ENV vars read by database.yml:
#
#    Name       ENV var               Purpose
#    ─────────  ────────────────────  ──────────────────────────────────────
#    primary    RAILS_DB_PATH         Application data  (articles, etc.)
#    cache      RAILS_DB_CACHE_PATH   ActiveSupport::Cache store
#    queue      RAILS_DB_QUEUE_PATH   SolidQueue background jobs
#    cable      RAILS_DB_CABLE_PATH   ActionCable pub/sub
#
#  Only `primary` has hand-written migrations in db/migrate/.
#  The other three are schema-managed by their respective Rails engines
#  (SolidCache, SolidQueue, ActionCable) which run their own internal
#  migrations separately — we skip them here to avoid double-migration.
#
#  CONNECTION MANAGEMENT
#  ─────────────────────
#  Rails 8 multi-db uses a connection pool per named database. When we call
#  MigrationContext.migrate, it executes against whatever connection
#  ActiveRecord::Base currently holds. If we don't explicitly switch to the
#  primary db_config first, the migration may run against a stale or wrong
#  connection (especially on cold boot before the pool is fully resolved).
#
#  We therefore:
#    1. establish_connection(db_config.configuration_hash)  — point AR::Base
#       at the exact SQLite file we just created
#    2. migrate                                             — run pending
#    3. establish_connection(:primary)                      — restore the
#       named :primary config so the rest of the app boots normally
#
#  ERROR HANDLING
#  ──────────────
#  Any failure here re-raises after logging, which intentionally crashes
#  the Rails boot. A half-migrated database is worse than no boot at all —
#  it would produce confusing runtime errors instead of a clear message.
#  The full error + first 5 backtrace lines are written to rails.log in
#  userData so the user (or developer) can open them via Help → Open Log.
# ═══════════════════════════════════════════════════════════════════════════

if Rails.env.production?
  begin
    Rails.logger.info "⏳ Ensuring production databases exist..."

    ActiveRecord::Base.configurations.configs_for(env_name: 'production').each do |db_config|

      # ── Step 1: Create ─────────────────────────────────────────────────
      # Creates the SQLite file on disk if it does not already exist.
      # Safe to call on every boot — skips silently if the file is present.
      # The actual file path comes from database.yml → ENV.fetch(RAILS_DB_*).
      ActiveRecord::Tasks::DatabaseTasks.create(db_config)

      # ── Step 2: Migrate (primary only) ────────────────────────────────
      # cache / queue / cable have no files in db/migrate — their schemas
      # are owned by SolidCache / SolidQueue / ActionCable engines and are
      # bootstrapped separately. Attempting to migrate them here would raise
      # "No migrations found" or silently migrate the wrong schema.
      next unless db_config.name == 'primary'

      # ── Step 3: Switch connection to this exact database ───────────────
      # Passing configuration_hash (a plain Hash) rather than a symbol
      # bypasses Rails' named-connection lookup and pins AR::Base directly
      # to the SQLite file path we resolved above. This prevents the
      # migration from running against a different pool entry.
      ActiveRecord::Base.establish_connection(db_config.configuration_hash)

      # ── Step 4: Run pending migrations ────────────────────────────────
      # MigrationContext scans db/migrate/, compares against
      # schema_migrations table, and applies only pending files in version
      # order. Falls through instantly if schema is already current.
      # migrations_paths comes from database.yml; falls back to db/migrate
      # for safety in case the config omits the key.
      ActiveRecord::MigrationContext.new(db_config.migrations_paths.presence || 'db/migrate').migrate

      Rails.logger.info "✅ #{db_config.name} migrated and ready."
    end

    # ── Step 5: Restore named :primary connection ──────────────────────────
    # After calling establish_connection with a raw Hash, AR::Base is bound
    # to an anonymous pool. Restoring the :primary symbol hands control back
    # to Rails' standard multi-db connection handler so models, controllers,
    # and engine initializers that run after this file all resolve correctly.
    ActiveRecord::Base.establish_connection(:primary)

    Rails.logger.info "✅ All production databases ready."

  rescue => e
    # Log class + message + top of backtrace before re-raising.
    # The re-raise is intentional — a failed migration must halt boot.
    # The user will see a crash; they can open Help → Open Log for details.
    Rails.logger.error "❌ Auto-migrate failed: #{e.class} — #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    raise
  end
end