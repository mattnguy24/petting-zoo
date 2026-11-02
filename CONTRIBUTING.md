# Contributing to Petting Zoo

## Building from source

```bash
npm install
npm test          # compile and run the tests
npm run package   # build petting-zoo-<version>.vsix
```

Open the folder in VS Code and press **F5** to launch a window with the extension loaded. Changes recompile automatically while it runs.

To install a build, open the Extensions view, choose **···** › **Install from VSIX…**, and pick the `.vsix` file.

## Project layout

```
src/
  engine/       pet behaviour and physics: states, walking, jumping, terrain
  sprites/      the pixel art, drawn as 16x16 character grids
  vscode/       editor integration: reading the code as terrain, drawing pets, commands
  extension.ts  activation and command registration
  test/         tests for the pet behaviour
images/         Marketplace icon
```

## Adding a pet

1. Draw it in `src/sprites/critters.ts`. Each pet is a 16x16 grid, one character per pixel, facing right. `.` is transparent, `k` is the outline, `e` is an eye and `i` its white shine (draw eyes 2 pixels tall so they blink nicely), `h` and `s` are the highlight and shadow tones, and any other letter maps to a colour in the pet's palette. `makeFrames` builds the blink, walk, landing, falling and sleeping frames from one body drawing plus a few leg poses.
2. Add the pet's name to `PetKind` and `PET_KINDS`, and give it a personality in `TRAITS`, in `src/engine/pet.ts`.
3. Add its icon, display name and description to `CATALOG` in `src/vscode/petManager.ts`.
4. Add it to the `pettingZoo.defaultPet` list in `package.json`.

Run `npm test`. The tests check that every frame is 16x16 and that the new pet never ends up standing on thin air.

## How pets are drawn

VS Code doesn't let extensions draw directly over the editor, so each pet is a text decoration styled as a small absolutely positioned image. All of that lives in `src/vscode/renderer.ts`.

## Releasing

Releases publish to the Visual Studio Marketplace automatically through GitHub Actions (`.github/workflows/publish.yml`).

1. Bump `version` in `package.json` and add an entry at the top of `CHANGELOG.md`.
2. Commit and push to `main`.
3. On GitHub, create a release with a tag matching the version, e.g. `v1.0.1`.

The workflow runs the tests, checks the tag matches `package.json`, and publishes. It signs in through a Trusted Publishing policy on the Marketplace publisher page, so no tokens or secrets are stored in the repo.
