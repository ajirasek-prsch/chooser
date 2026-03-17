# Player Chooser

Player chooser web app. Every player places a finger on the screen. After 2 seconds the app picks one player at random. Helpful when choosing the starting player in a board game.

![](./res/demo.gif)

## Modes

### Single selection (default)

The original behaviour: all players touch the screen, the app waits 2 seconds, then highlights one at random with an animated spotlight effect.

### Group selection

Touches are automatically divided into colour-coded groups using round-robin assignment (first touch → Group A, second → Group B, …, wrapping back after the last group). A legend at the bottom shows each group's colour, label, and how many active touches belong to it.

**Controls (visible in Group mode):**

| Control | Description |
|---------|-------------|
| **−** / **+** buttons | Decrease or increase the number of groups (2–8, default 2) |
| **Clear All** | Remove all touches and reset the round-robin counter |

Switching modes or changing the group count clears all active touches automatically to avoid confusion.

## Running locally

This project has no dependencies or build steps. Start any static file server pointing at the `src/` directory. Example with Python:

```sh
python3 -m http.server --directory src
```

Then open <http://localhost:8000> in your browser.

## Deployment (GitHub Pages)

A GitHub Actions workflow at `.github/workflows/pages.yml` automatically deploys the `src/` directory to GitHub Pages on every push to `main`.

**How it works:**

1. `actions/checkout` – checks out the repository.
2. `actions/configure-pages` – configures the Pages environment.
3. `actions/upload-pages-artifact` – packages `src/` as the Pages artifact.
4. `actions/deploy-pages` – publishes the artifact to the CDN.

No build step is required because the app is plain HTML/CSS/JS. The service worker (`sw.js`) computes its cache paths dynamically from its own URL, so the app works both at the site root (localhost) and under the `/chooser/` sub-path on GitHub Pages.

The published URL will be `https://<org>.github.io/chooser/`.

## Updating the Service Worker

After adding, changing, or deleting any file in `src/`, update the cache list in [`sw.js`](./src/sw.js) and increment `CACHE_NAME` (currently `v8`). This ensures all users receive the update.

