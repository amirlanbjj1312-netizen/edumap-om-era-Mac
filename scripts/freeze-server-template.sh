#!/usr/bin/env bash
set -euo pipefail

# Run these commands on the production VPS, not locally.
# Adjust DB commands to your real database engine and credentials.

echo "1. Save backend env"
echo "cp /var/www/edumap/app/server/.env /root/edumap-server.env.backup"

echo
echo "2. Save pm2 process info"
echo "pm2 show edumap-server > /root/edumap-pm2-show.txt"
echo "pm2 save"

echo
echo "3. Save nginx config"
echo "cp /etc/nginx/sites-available/* /root/ 2>/dev/null || true"
echo "cp /etc/nginx/sites-enabled/* /root/ 2>/dev/null || true"

echo
echo "4. Save app directory"
echo "tar -czf /root/edumap-server-files.tar.gz -C /var/www/edumap app/server"

echo
echo "5. If Postgres, create DB dump"
echo "pg_dump -Fc -h HOST -U USER DB_NAME > /root/edumap-postgres.dump"

echo
echo "6. If MySQL, create DB dump"
echo "mysqldump -h HOST -u USER -p DB_NAME > /root/edumap-mysql.sql"

echo
echo "7. Optional: archive uploads"
echo "tar -czf /root/edumap-uploads.tar.gz /path/to/uploads"

echo
echo "8. Download backups from VPS to local machine"
echo "scp root@185.129.51.161:/root/edumap-server.env.backup ."
echo "scp root@185.129.51.161:/root/edumap-pm2-show.txt ."
echo "scp root@185.129.51.161:/root/edumap-server-files.tar.gz ."
echo "scp root@185.129.51.161:/root/edumap-postgres.dump ."
echo "scp root@185.129.51.161:/root/edumap-mysql.sql ."
