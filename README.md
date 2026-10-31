# NEON ORBIT

A small game. A well-earned break.

A polished, responsive arcade survival game built with React, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide, and an original Canvas renderer. No accounts, backend, tracking, or external art assets.

## Run locally

Requires Node.js 24 and npm 11 (the versions used for validation).

```sh
npm ci
npm run dev
```

Open the address printed by Vite. For a production preview:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

## Play

- Move your bright sphere using **WASD** or **arrow keys**.
- On mobile, **hold and drag** on the arena. Mouse dragging also works.
- Collect green sparks for **100 points** each. Survive for **5 points per second**.
- Avoid violet obstacles. One collision ends your run.
- Difficulty increases every **15 seconds**.
- Pause with **Esc**, **P**, **Space**, or the pause button. Switching tabs or leaving the window also pauses the game.
- Resume or restart from the overlay. Your best score is saved on this device.

Settings include sound, ambient motion, and dark/light/system appearance. OS reduced-motion preferences always take precedence. Sound uses short, locally synthesized tones, activated by a user gesture. Local storage failures and unsupported fullscreen do not prevent play.

## Structure

```text
src/
  App.tsx                Interface, dialogs, settings, game states
  GameCanvas.tsx         Rendering lifecycle, input, resize, cleanup
  game/engine.ts         Frame-independent simulation and Canvas art
  game/engine.test.ts    Collision, scoring, input, difficulty tests
  game/audio.ts         Gesture-activated Web Audio synthesis
  storage.ts            Defensive persistence helpers
  styles.css            Responsive theme and visual system
.github/workflows/
  deploy.yml            Build, test, and deploy to GitHub Pages
```

The simulation caps elapsed time after slow frames and uses swept-circle collision detection to prevent fast objects from tunneling through the player. Canvas resolution follows device pixel ratio, capped at 2 for performance. Resizing preserves relative positions. React HUD updates are throttled; rendering uses requestAnimationFrame. Listeners, observers, and animation frames are cleaned up on unmount.

## GitHub Pages

The project is prepared for a public repository named `neon-orbit-game`. Publishing requires the owner's explicit approval. No automatic repository creation or push is performed by local setup.

After approval, create the repository, push the project to `main`, and select **Settings → Pages → Source → GitHub Actions**. The included workflow runs the tests and TypeScript checks, builds, and deploys the `dist` artifact. Set the default branch to `main`.

The workflow sets `GITHUB_PAGES=true`, which builds with base path `/neon-orbit-game/`. Local builds use `/`. If the repository name changes, update `vite.config.ts`. No client-side router or API secrets are required.

```sh
GITHUB_PAGES=true npm run build
GITHUB_PAGES=true npm run preview
```

The live URL is available from the successful deployment job; it is not available until publication succeeds.

## Browser checks

Playwright is included as a development dependency. The browser smoke tests in `e2e/` use an installed Chromium executable (default `/usr/bin/chromium`, override with `CHROMIUM_PATH`) and a running Vite server. Run with `npx playwright test`. They cover the menu, keyboard/touch play, pause/resume, game over/restart, settings, persistence, responsive layout, and reduced motion.

Original procedural orbit artwork and interface design. No proprietary logos or artwork.
