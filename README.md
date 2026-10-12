# CribSheet

A simple, private baby tracker for the newborn weeks: feeds, diapers, pumping, and growth. No insights, no clutter, no subscription. Built as a progressive web app so it installs to a phone's home screen and works offline.

Live site: https://projects.scottcardone.com/cribsheet/

## What it does

- **Nursing** with a timer. It tells you which breast to start on (alternating from the last feed), you tap Start on that side, tap Switch when you change sides, and tap Finish to log the feed automatically with time on each side. The timer survives locking the phone. You can also log a feed by hand with a start time and minutes per side.
- **Bottles** in oz or mL, marked as breast milk or formula.
- **Diapers** as wet, dirty, or both.
- **Measurements**: weight in lb + oz or grams, length and head circumference in inches or cm. Enter whichever ones you have.
- **Pumping** on its own tab, built to be fast: amount and time, done.
- **Dashboard** with totals for today, the last 24 hours, and a daily average computed over the trailing 7 days (or over however many days you have logged so far, if fewer).
- **Right now** card: time since the last feed, last diaper, and last pump, plus which side to start on next.
- **Log** of everything, grouped by day, filterable by type. Tap any entry to edit or delete it (with undo).
- **Growth** tab with a plain line chart for each measurement and the change since the last reading.
- **Multiple babies** with a switcher in the header. Pumping is shared across babies.
- **Export** to CSV for the pediatrician, JSON backup and restore, and dark mode for night feeds.
- **Sync between phones** through your own free Firebase project (optional, see below).

Every time field defaults to now and can be changed, so you can log something that happened earlier.

## Files

- `index.html`: markup and styles.
- `app.js`: all of the logic. No build step, no bundler.
- `firebase-config.js`: paste your Firebase config here to turn on sync. Empty means local only.
- `sw.js`: service worker that caches the app for offline use.
- `site.webmanifest`, `favicon*`, `apple-touch-icon.png`: install icons from the Cardone Medical Consulting brand package.
- `brand/`: logo files used by the header and footer.
- `.nojekyll`: tells GitHub Pages to serve the files as they are.

## Publishing on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open **Settings > Pages**, set **Source** to *Deploy from a branch*, choose **main** and the root folder, and save.
3. The site goes live at `https://<user>.github.io/<repo>/` within a minute or two. Every commit to `main` updates it.

On a phone, open the site in Safari or Chrome and use **Add to Home Screen**. It then runs full screen like an app.

## Turning on sync (optional)

Without this, each phone keeps its own log. With it, every phone that joins the same household sees the same log in real time, and still works offline.

1. Go to https://console.firebase.google.com and create a project (any name, Google Analytics can stay off).
2. **Build > Authentication > Get started > Sign-in method**: enable **Anonymous**.
3. **Build > Firestore Database > Create database**: pick a location near you and start in **production mode**.
4. In **Firestore > Rules**, replace the rules with the block below and publish:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /households/{household}/{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

5. **Project settings (gear icon) > Your apps > Add app > Web**. Give it a nickname, skip hosting, and copy the `firebaseConfig` values into `firebase-config.js`.
6. Under **Authentication > Settings > Authorized domains**, add the domain the site is served from (for example `projects.scottcardone.com` or `<user>.github.io`).
7. Commit and push. On one phone, open **Settings > Sync** and tap **Create household**. It shows an 8-character code. On the other phone, tap **Join with code** and enter it. If a phone already has local entries, it offers to upload them.

The rules let any signed-in (anonymous) user read a household if they know its code, so the code acts as the password. It is random enough for a family log, but do not post it anywhere public.

## Data model

Entries live in one list and carry a `type`: `nurse`, `bottle`, `diaper`, `pump`, or `measure`. Volumes are stored in mL and weights in grams, with the unit you typed kept alongside so edits show what you entered. Local mode stores everything in `localStorage`; sync mode stores it under `households/<code>/entries` and `households/<code>/babies` in Firestore.

## Disclaimer

CribSheet is a logbook, not medical advice. Talk to your pediatrician about feeding, weight gain, or diaper counts that concern you.

© 2026 Cardone Medical Consulting, LLC. Code is released under the MIT License (see `LICENSE`).
