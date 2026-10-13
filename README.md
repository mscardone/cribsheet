# CribSheet

A simple, private baby tracker for the newborn weeks: feeds, diapers, pumping, and growth. No insights, no clutter, no subscription. Built as a progressive web app so it installs to a phone's home screen and works offline.

Live site: https://projects.scottcardone.com/cribsheet/

## What it does

- **Feeds** in one entry, however the feed went: nursing, bottle, syringe, or nursing finished with a bottle or syringe. The nursing timer tells you which breast to start on (alternating from the last feed), you tap Start on that side, Switch when you change sides, and Finish to log it. If you top up with a bottle or syringe, add the amount on the timer screen before Finish and it all goes in the same entry. The timer survives locking the phone. You can also log a feed by hand with a start time, minutes per side, and an amount in oz or mL, marked breast milk or formula.
- **Sleep** with one button. Tap **Sleep** when the baby falls asleep and the button turns into **Wake up** with a running clock; tap it when they wake and the sleep is logged. The in-progress sleep is stored in the log itself, so it survives closing the app and shows on the other parent's phone too. Tap **adjust** on the Home tab to backdate the start, or **log past sleep** if you forgot to start it. Sleep that starts inside the night window (7 PM to 7 AM by default, adjustable in Settings) counts as overnight; the rest are naps, and you can override either per entry.
- **Diapers** as wet, dirty, or both.
- **Measurements**: weight in lb + oz or grams, length and head circumference in inches or cm. Enter whichever ones you have.
- **Growth charts** like the ones in a pediatric office: each measurement plotted by age against the WHO Child Growth Standards for the baby's sex (birth to 24 months, as published by the CDC and used by US pediatricians under age 2), with the 1st, 25th, 50th, 75th and 99th percentile curves, and the percentile for each reading.
- **Meds** with dose calculators that show their work. Infant Tylenol (160 mg/5 mL, 15 mg/kg every 6 h, max 5 a day), Infant Motrin (50 mg/1.25 mL) and Children's Motrin (100 mg/5 mL) at 10 mg/kg every 6 h (max 4 a day), simethicone (20 mg/0.3 mL by the label's weight and age brackets), cetirizine (1 mg/mL by age), Vitamin D 400 IU daily, amoxicillin from the prescribed mg/kg/day, and a free-text entry for anything else. The weight comes from the latest logged measurement and can be changed in the calculator. Every dose is rounded to the nearest 0.1 mL and printed with the full chain (lb and oz to kg, mg/kg, concentration, mL) so it can be checked. Motrin and cetirizine stay locked until 6 months of age. Logging a dose sooner than the interval allows, or past the daily maximum, shows a red warning but does not block. The Home card shows the last dose and when the next one is allowed, and whether Vitamin D has been given today.
- **Pumping** on its own tab, built to be fast: amount and time, done.
- **Dashboard** with totals for today, the last 24 hours, and a daily average computed over the trailing 7 days (or over however many days you have logged so far, if fewer). Covers feeds, nursing time by side, bottle or syringe volume split by breast milk and formula, total sleep, overnight sleep, nap time and count, diapers, and pumping.
- **Right now** card: time since the last feed, when the next one is due, whether the baby is asleep or how long they have been awake, last diaper, last pump, latest weight, and which side to start on next.
- **Feed reminders** (Settings): pick an interval (3 hours by default, counted from the start of the last feed). The Home tab shows a countdown and turns amber, then red, as the feed comes due. With notifications allowed, a notification fires when the interval passes while CribSheet is open or in the background. See the note below on what it cannot do.
- **Log** of everything, grouped by day, filterable by type. Tap any entry to edit or delete it (with undo).
- **Multiple babies** with a switcher in the header. Each profile has a name, optional photo (shrunk in the browser and stored with the profile), sex, birth date and optional birth time, and optional birth weight, length and head circumference, which become the first measurement on the growth charts. Pumping is shared across babies.
- **Export** to CSV for the pediatrician, JSON backup and restore, and dark mode for night feeds.
- **Sync between phones** through a free Firebase project, so both parents see the same log in real time.
- **Install** card in Settings with an Install button on Android and Chrome, and instructions on iPhone.

Every time field defaults to now and can be changed, so you can log something that happened earlier.

### What feed reminders cannot do

A static site has no server, so it cannot wake a closed app to send a push notification. Reminders fire when CribSheet is open, in a background tab, or installed on Android and still in memory. On iPhone, notifications only work for an installed home-screen app and only through server push, which CribSheet does not have, so iPhone gets the on-screen countdown but no banner. True push while the app is closed would need a small scheduled job (a Cloud Function or a GitHub Actions cron) holding push keys; that is a possible later addition.

## Files

- `index.html`: markup and styles.
- `app.js`: all of the logic. No build step, no bundler.
- `growth-data.js`: WHO growth standard LMS parameters (birth to 24 months, boys and girls) from the CDC data files, used to draw percentile curves and compute percentiles.
- `firebase-config.js`: the Firebase web config that turns on sync. Blank it out for local-only mode.
- `version.js`: the version number shown in the footer and used by the service worker to detect updates.
- `sw.js`: service worker that caches the app for offline use.
- `site.webmanifest`, `favicon*`, `apple-touch-icon.png`: CribSheet Swaddled C install icons.
- `brand/`: CribSheet vector artwork and icon generator, plus the Cardone Medical Consulting footer logo. See `brand/BRANDING.md` for design details and regeneration instructions.
- `.nojekyll`: tells GitHub Pages to serve the files as they are.

## Releasing a new version

Edit `version.js` and bump the version and date, then commit and push. The footer shows the version, and the service worker uses it as its cache name, so installed phones notice the change on their next launch or foreground (and hourly while open) and show an amber "new version is ready, Refresh" banner at the top. Tapping it reloads into the new build. Changes pushed without bumping `version.js` still arrive on the next normal reload, but without the banner.

## Publishing on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open **Settings > Pages**, set **Source** to *Deploy from a branch*, choose **main** and the root folder, and save.
3. The site goes live at `https://<user>.github.io/<repo>/` within a minute or two. Every commit to `main` updates it.

On a phone, open the site in Safari or Chrome and use **Add to Home Screen**. It then runs full screen like an app.

## Sync between phones

Sync is already wired to the `CribSheet` Firebase project (`cribsheet-62322`), with anonymous sign-in enabled, Firestore in production mode, the rules below published, and `projects.scottcardone.com` and `mscardone.github.io` authorized. Nothing more to configure.

To use it: on one phone open **Settings > Sync between phones** and tap **Create household**. It shows an 8-character code. On the other phone tap **Join with code** and enter it. If a phone already has local entries, it offers to upload them. Both phones then see the same log in real time and keep working offline.

The rules let any signed-in (anonymous) user read a household if they know its code, so the code acts as the password. It is random enough for a family log, but do not post it anywhere public.

### Setting it up again from scratch

If you ever need a fresh Firebase project (for example to hand this app to another family):

1. Go to https://console.firebase.google.com and create a project. Google Analytics and Gemini can stay off.
2. **Build > Authentication > Get started > Sign-in method**: enable **Anonymous**. Leave automatic clean-up off.
3. **Build > Firestore Database > Create database**: pick a location and start in **production mode**.
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
6. Under **Authentication > Settings > Authorized domains**, add the domain the site is served from.
7. Commit and push.

To run with no sync at all, blank out `apiKey` and `projectId` in `firebase-config.js`.

## Data model

Entries live in one list and carry a `type`: `feed`, `sleep`, `med`, `diaper`, `pump`, or `measure`. A feed can hold nursing seconds per side and a bottle or syringe volume at once. A sleep has a start and an end; an end of `null` means still asleep. Entries written by early versions as `nurse` or `bottle` are read as feeds. Volumes are stored in mL and weights in grams, with the unit you typed kept alongside so edits show what you entered. Local mode stores everything in `localStorage`; sync mode stores it under `households/<code>/entries` and `households/<code>/babies` in Firestore.

## Disclaimer

CribSheet is a logbook, not medical advice. Talk to your pediatrician about feeding, weight gain, or diaper counts that concern you.

© 2026 Cardone Medical Consulting, LLC. Code is released under the MIT License (see `LICENSE`).
