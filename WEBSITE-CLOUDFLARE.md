# Guide 2: Link your website (on Cloudflare) to the app

Your website at www.epsilonacademy.co.uk stays as it is. You do two things:
1. Give the app its own address, app.epsilonacademy.co.uk, pointing at your VPS.
2. Add Login and "Join" buttons on your website that open the app.

## Part 1: Create the app address (do this BEFORE Guide 1)
1. Sign in at **dash.cloudflare.com** and click **epsilonacademy.co.uk**.
2. In the left menu, click **DNS**, then **Records**.
3. Press **Add record** and fill in:

   | Field | What to enter |
   |---|---|
   | **Type** | `A` |
   | **Name** | `app` |
   | **IPv4 address** | your VPS IP address (Hostinger hPanel → VPS → Overview) |
   | **Proxy status** | click the orange cloud so it turns **grey** ("DNS only") |
   | **TTL** | Auto |

4. Press **Save**.

**Do not change or delete any other records.** They keep your main website and email working.

**Why grey (DNS only):** it lets your VPS get and renew its own padlock certificate without any extra Cloudflare settings. Once everything works you can ask a technical helper about switching it to orange for extra protection. It isn't needed for the pilot.

**Check it worked:** after a few minutes, visit **https://dnschecker.org**, type `app.epsilonacademy.co.uk` and choose "A". Your VPS IP address should appear. Then do Guide 1.

## Part 2: Add Login and Join buttons to your website (after Guide 1 works)
The buttons are ordinary links:

| Button | Link |
|---|---|
| **Log in** | `https://app.epsilonacademy.co.uk/login.html` |
| **Join / Ask for access** | `https://app.epsilonacademy.co.uk/request.html` |

How you add them depends on how your website was built:
- **Website builder** (a drag-and-drop editor): add a button, set its link to the address above, and publish.
- **Existing "Login" section:** change that button's link to the Log in address above. Remove any old login form, because the app now does the logging in.
- **Code, such as a React site on Cloudflare Pages:** the button is one line. Pass it to whoever edits the site, or send me the site's code and I'll make the change:
  ```html
  <a href="https://app.epsilonacademy.co.uk/login.html">Log in</a>
  <a href="https://app.epsilonacademy.co.uk/request.html">Join</a>
  ```
  If the site deploys from GitHub, it goes live after the change is pushed.

**Test it:** open www.epsilonacademy.co.uk, click Log in, and check the Epsilon sign-in page opens with a padlock.

## Also link the privacy notice
Once the privacy notice is completed, add a "Privacy" link in your website footer to:
`https://app.epsilonacademy.co.uk/privacy.html`
