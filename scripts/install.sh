#!/usr/bin/env bash
# One-time setup on the Hostinger VPS (Ubuntu). Run as a normal user with sudo.
set -e
echo "== Epsilon Academy install =="
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node: $(node --version)"
mkdir -p data/backups
if [ ! -f config.json ]; then
  cp config.example.json config.json
  echo ""
  echo ">>> Created config.json. Put your own email in it, then run this installer again:"
  echo ">>>   nano config.json"
  exit 1
fi
if grep -q "you@yourdomain" config.json; then
  echo ">>> config.json still has the example email. Edit it first:  nano config.json"
  exit 1
fi
echo "Setting up the service so it stays running and restarts on reboot..."
SVC=/etc/systemd/system/epsilon.service
APPDIR="$(pwd)"
USER_NAME="$(whoami)"
sudo bash -c "cat > $SVC" <<UNIT
[Unit]
Description=Epsilon Academy
After=network.target
[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$APPDIR
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable epsilon
sudo systemctl restart epsilon
echo "Setting up a daily backup at 2am..."
CRON="0 2 * * * cd $APPDIR && $(command -v node) scripts/backup.js >> data/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'scripts/backup.js' ; echo "$CRON" ) | crontab -
echo "== Done. The one-time super-user password was printed in the service log: =="
echo "   sudo journalctl -u epsilon | grep -A5 'FIRST RUN'"
