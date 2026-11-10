# Our games

Two browser games, published with GitHub Pages so phones and tablets can install them as apps that work offline.

| Game | Folder |
| --- | --- |
| שְׁטִיפָה נוֹצֶצֶת (Shine Time), a 3D car wash | [shine-time/](shine-time/) |
| קֻבִּיּוֹת צִבְעוֹנִיּוֹת, a block-sliding puzzle | [blockout/](blockout/) |

**Install on a phone:** open a game, press the install button on its menu (or the browser's *Install app* / *Add to Home Screen*). After that it opens from the home screen and plays without internet.

## Updating the site

The game folders here are copies. Edit the games in their own project folders, then run:

```bash
node publish.mjs            # copy both games, commit and push
node publish.mjs --no-push  # copy only, to check first
```

The site updates within a minute or two. Installed apps get the new version the next time they open with internet.
