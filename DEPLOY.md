# Guide 1: Put Epsilon Academy on your VPS

For a non-technical owner. Do one step at a time. Anything in a grey box is typed exactly, then press Enter.

**Before you start:** do Guide 2, Part 1 (the Cloudflare address) first. It takes a few minutes to switch on, and Step 6 below needs it.

**The address:** the app will live at **https://app.epsilonacademy.co.uk**. Your main website stays exactly where it is on Cloudflare.

## What you need
- **Your VPS IP address:** Hostinger hPanel → VPS → Overview.
- **Your VPS root password:** use the new one, after you have changed it.
- **FileZilla:** free, from filezilla-project.org. Get "FileZilla Client".
- **The file `epsilon-server.zip`.**

## Step 1: Upload the zip to the VPS
1. Open FileZilla. Along the top, fill in:
   - **Host:** `sftp://` followed by your VPS IP address.
   - **Username:** `root`
   - **Password:** your VPS password
   - **Port:** `22`

   Press **Quickconnect** and accept the "unknown host key" message.
2. Drag `epsilon-server.zip` from your computer (left side) into the right side, which is the `/root` folder.

## Step 2: Open the VPS terminal
In Hostinger hPanel → VPS, press **Browser terminal**. A black window opens. That is where you type.

## Step 3: Unpack the files
```
apt-get update && apt-get install -y unzip
unzip epsilon-server.zip
cd epsilon-server
```

## Step 4: Put your email in the settings
```
cp config.example.json config.json
nano config.json
```
1. Use the arrow keys to change `you@yourdomain.co.uk` to your real email, and `Your name` to your name. Leave everything else alone.
2. To save, press **Ctrl+O**, then **Enter**. To exit, press **Ctrl+X**.

This email becomes your owner (super user) sign-in.

## Step 5: Install and start the app
```
bash scripts/install.sh
```
This installs what's needed and starts the app. It also makes the app restart by itself after a reboot, and turns on a nightly backup at 2am.

Then get your one-time owner password:
```
journalctl -u epsilon | grep -A5 "FIRST RUN"
```
Write the password down. Keep it private.

## Step 6: Connect the web address with a padlock (https)
Check Guide 2, Part 1 is done first. Then copy and paste this whole block in one go:
```
apt-get install -y nginx certbot python3-certbot-nginx
cat > /etc/nginx/sites-available/epsilon <<'NG'
server {
  listen 80;
  server_name app.epsilonacademy.co.uk;
  client_max_body_size 5m;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NG
ln -sf /etc/nginx/sites-available/epsilon /etc/nginx/sites-enabled/epsilon
nginx -t && systemctl reload nginx
certbot --nginx -d app.epsilonacademy.co.uk
```
Certbot asks three things:
1. Your email: type it.
2. Whether you agree to the terms: type **Y**.
3. Whether you'll share your email: type **N**.

It then sets up the padlock and renews it by itself.

## Step 7: Sign in
1. Go to **https://app.epsilonacademy.co.uk/login.html** and sign in with your email and the one-time password.
2. Set your own password when asked. You are now in the Control Room.

## Step 8: Load the Year 7 Maths questions
In the terminal:
```
cd ~/epsilon-server
node scripts/import-content.js content/year7-maths-approved.json
```
Type your email and your new password when asked. You should see "Imported 104 approved questions".

## Everyday help
- **See what the app is doing:** `journalctl -u epsilon -n 50`
- **Restart it:** `systemctl restart epsilon`
- **Back up now:** `cd ~/epsilon-server && node scripts/backup.js` (automatic backups go to `data/backups/`)
- **All the data is in one file:** `~/epsilon-server/data/store.json`. Keep a copy somewhere safe now and then (FileZilla can download it).

## Still to do before real children use it
Complete the privacy notice (a draft is at `/privacy.html`), run a DPIA, and record parental consent for each child. The app blocks a student from saving work until you record consent. This is engineering guidance, not legal advice.
