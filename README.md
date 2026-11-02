# Petting Zoo

Tiny pixel pets that live **on top of your code**.

*Inspired by [vscode-pets](https://github.com/tonybaloney/vscode-pets). Instead of a separate panel, these pets live right on your code.*

They walk along your lines, hop between nested blocks, fall through blank lines, curl up for naps, and leap back into view when you scroll away. Click one to give it a pat. Choose from fifteen pets drawn in a cute, nostalgic pixel style, and keep as many as you like.

## Meet the pets

| Pet | Personality |
| --- | --- |
| 🐱 Orange Cat | Curious and hoppy, naps a lot |
| 🐈 Gray Cat | Calm, little white socks, the sleepiest of the bunch |
| 🐕 Shiba Inu | Zoomies! Fast and full of energy |
| 🐶 Puppy | Floppy ears, happy to follow you around |
| 🦮 Golden Retriever | Big friendly goofball, loves everyone |
| 🐕 Corgi | Tiny legs, huge ears, endless enthusiasm |
| 🐰 Bunny | Hops everywhere, loves a gentle pat |
| 🐔 Chicken | Busy and chatty, always on the move |
| 🐥 Duckling | Slow waddler, takes cozy naps |
| 🍄 Mushroom | Tiny and sleepy, bounces around on no legs at all |
| 🐹 Guinea Pig | Round, slow and sleepy, adores being petted |
| 🐭 Mouse | Quick and nervous, scurries off when you reach for it |
| 🟢 Slime | Squishy and bouncy, loves to hop up |
| 🐞 Bug | Scuttles around, skitters off when you click it |
| 🪳 Roach | Very fast, never sleeps, scatters at the slightest touch |

## Getting started

Install the extension and open any file. A cat drops onto your code to say hello.

To add more pets, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Petting Zoo: Add a Pet**. Pick a pet, give it a name, and it jumps in.

Your pets are remembered between sessions.

## How pets get around

- **Your code is the terrain.** Each line of code is a platform. Indentation turns nested blocks into staircases, and blank lines are gaps that pets fall through.
- **Wide gaps have to be jumped.** A stretch of 5 or more spaces inside a line, like aligned comments, is a hole. Pets leap across it, turn back, or drop through.
- **Scrolling:** scroll down past your pets and they drop in from the top of the screen. Scroll back up and they leap up from the bottom.
- **Editing:** pets ride along with their line as you type. Delete the code under one and it falls.
- **Switching files:** your pets follow you into whichever editor you're using.

## Playing with your pets

- **Click** a pet to pet it. It does a happy little hop and a heart pops up **♥**. Keep petting for more hearts. Click a sleeping pet and it wakes with a start **!**
- The **bug**, **roach** and **mouse** aren't the cuddly type: click one and it scurries away **!**
- **Move your text cursor** into a pet and it hops out of the way.
- Left alone, pets look around, hum **♪**, do little hops, and eventually curl up for a nap **z z z**.

Each pet has its own temperament: some are speedy, some are sleepy, and the roach never stops moving.

Prefer them to mind their own business? Turn off `pettingZoo.reactions`.

## Commands

All commands are in the Command Palette under **Petting Zoo**:

| Command | What it does |
| --- | --- |
| Add a Pet | Choose a pet, name it, and add it |
| Call Pets to Cursor | Everyone jumps to the line your cursor is on |
| Remove a Pet | Send one pet home |
| Remove All Pets | Send everyone home |
| Pause / Resume Pets | Hide your pets for a while, and bring them back |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `pettingZoo.reactions` | `true` | Clicking pets them (the bug, roach and mouse scurry off instead), and pets hop away from your text cursor. |
| `pettingZoo.scale` | `0` | Pet size. `0` sizes pets to fit your editor's line height; `1`–`6` sets the pixel scale. |
| `pettingZoo.fps` | `15` | Animation frames per second (5–30). Lower uses less CPU. |
| `pettingZoo.gapWidth` | `5` | How many blank columns in a row count as a gap pets must jump. |
| `pettingZoo.defaultPet` | `cat` | The pet you start with on first install. |

## Performance

Pets only look at the lines on screen and animate at a modest frame rate. They pause entirely while VS Code is in the background, so they use no CPU when you're not looking.

## Known issues

- With word wrap on, a wrapped line counts as one platform, so pets may appear slightly off the text on wrapped lines.
- On very long lines scrolled sideways, pets may sit slightly off from where the text is drawn.
- Wide characters (for example CJK text or emoji) take up more space than pets expect, so pets can drift a little on those lines.
- Clicks register on the pet's line of code. Clicking empty space past the end of a line moves the cursor to the end of that line, so to pet a pet, click on or near the code it's standing on.

## Release notes

See the **Changelog** tab for what's new in each version.

## License

MIT
