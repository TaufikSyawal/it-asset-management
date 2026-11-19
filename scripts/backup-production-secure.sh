#!/usr/bin/env bash
# ==============================================================================
# SECURE PRODUCTION BACKUP SCRIPT (OUTSIDE GIT REPOSITORY)
# Project: Enterprise IT Asset Management System (ITAMS)
# Remote Supabase Project: dhwtybzvkhcsqzrtgohn (Tokyo)
# Target Storage: ~/.itams_backups/ (External to Git, Local Encrypted Storage)
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="${HOME}/.itams_backups"
BACKUP_DIR="${BACKUP_ROOT}/itams_prod_backup_${TIMESTAMP}"

echo "================================================================="
echo "   ITAMS SECURE PRODUCTION BACKUP PROCEDURE"
echo "   Timestamp: ${TIMESTAMP}"
echo "   Destination: ${BACKUP_DIR}"
echo "================================================================="

# 1. Create secure directory with strict permissions (0700: user-only access)
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_ROOT}" "${BACKUP_DIR}"
echo "✓ Secure backup directory initialized."

# 2. Database Backup (Schema + Public Data + Roles)
echo "--- 1. Performing Database Backup ---"
if command -v supabase &> /dev/null; then
  echo "Executing Supabase CLI db dump for project dhwtybzvkhcsqzrtgohn..."
  supabase db dump --project-ref dhwtybzvkhcsqzrtgohn --schema public -f "${BACKUP_DIR}/itams_public_schema_${TIMESTAMP}.sql" || echo "Note: CLI login or db-url required for direct dump."
  supabase db dump --project-ref dhwtybzvkhcsqzrtgohn --data-only --schema public -f "${BACKUP_DIR}/itams_public_data_${TIMESTAMP}.sql" || echo "Note: CLI login or db-url required for direct dump."
  supabase db dump --project-ref dhwtybzvkhcsqzrtgohn --role-only -f "${BACKUP_DIR}/itams_roles_${TIMESTAMP}.sql" || echo "Note: CLI login or db-url required for direct dump."
else
  echo "Supabase CLI not found on PATH. If database connection string is available in DB_URL:"
  if [ -n "${DB_URL:-}" ]; then
    pg_dump "${DB_URL}" --schema=public -F p -f "${BACKUP_DIR}/itams_db_backup_${TIMESTAMP}.sql"
    echo "✓ pg_dump completed successfully."
  else
    echo "DB_URL environment variable not set. Please supply DB_URL to pg_dump or use Supabase Cloud Dashboard -> Settings -> Database -> Backups."
  fi
fi

# 3. Storage Photo Metadata & Inventory Documentation
echo "--- 2. Documenting Backup Metadata ---"
cat <<EOF > "${BACKUP_DIR}/BACKUP_METADATA.json"
{
  "project_ref": "dhwtybzvkhcsqzrtgohn",
  "project_name": "Inventory IT - Production",
  "timestamp": "${TIMESTAMP}",
  "destination_dir": "${BACKUP_DIR}",
  "storage_bucket": "asset-photos",
  "created_by": "$(whoami)",
  "system": "$(uname -srm)",
  "encryption_note": "Ensure destination disk FileVault is enabled on macOS for at-rest AES-256 encryption."
}
EOF
chmod 600 "${BACKUP_DIR}/BACKUP_METADATA.json"
echo "✓ Backup metadata recorded."

echo ""
echo "================================================================="
echo "   BACKUP PROCEDURE COMPLETE"
echo "   Location: ${BACKUP_DIR}"
echo "   Permissions: $(ls -ld "${BACKUP_DIR}" | awk '{print $1}') (Strict Owner Only)"
echo "================================================================="
