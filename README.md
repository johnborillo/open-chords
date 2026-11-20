# Open Chords

A quiet workspace for importing, transposing, and practicing chord sheets. Songs and preferences stay in the browser; a small Worker fetches public Ultimate Guitar links when requested. Includes original demo songs; no Ultimate Guitar content is bundled.

## Run

Requires Node 22+.

```sh
npm ci
npm run build
npm run dev
```

Open `http://localhost:4173`. `npm run build` bundles the frontend assets and direct-link endpoint into `dist/server/index.js`, a Cloudflare Worker ES module. The authored frontend remains in `dist/index.html`, `dist/styles.css`, and `dist/src/`; server code is in `server/`. Notation fonts and alphaTab are served locally by the Worker. No application API keys or backend database are required. The hosted version is public to anyone with its URL. Search engines are asked not to index it; this is not access control. Libraries remain local to each browser. The Worker hosting keeps direct-link imports available; GitHub Pages alone cannot run this endpoint.

## Deploy to Vercel

Import this GitHub repository into Vercel. The checked-in `vercel.json` selects the build and output directory automatically; leave the framework preset as **Other**. No application secrets or database are required. `npm run check:vercel` builds and validates the deployment locally.

The Vercel build copies only the frontend asset allowlist into `build/vercel-public`, including required fonts and third-party notices. `api/import/ultimate-guitar.js` runs the existing bounded importer as a Node.js function at the same URL used by the reader. The function allows 30 seconds, with the upstream fetch still limited to 15 seconds. Worker bundles, research files, and Sites metadata are excluded from the static output. The default `npm run build` continues to build the existing Sites Worker.

GitHub Pages can host the reader but cannot run the direct-link endpoint. Use Vercel to keep the full app on one host. The public site requests no indexing, but anyone with the URL can access it. A new hostname has separate browser storage: back up your library in Settings on the old site, then restore that backup on the new site. Each friend's library stays in their own browser.

## Bring in a sheet

- **Ultimate Guitar link:** Import a song → Ultimate Guitar is now the default. Paste a specific `tabs.ultimate-guitar.com/tab/…` Chords/text Tab URL, including short numeric share links such as `/tab/1789723`, and click **Import from link**. The Worker fetches its public HTML and returns normalized song data, preserving source/author. Scheme-less and `www.ultimate-guitar.com/tab/…` links are normalized; tracking queries/fragments are removed. Only the exact sheet URL host is fetched, and every redirect is revalidated.
- **UG fallback:** If the site blocks the fetch, the same panel opens **Other ways to bring in a UG sheet**. Use the export bookmark, upload saved HTML / `.openchords.json`, or paste visible text. Paid/blocked scores, interactive Pro scores, search pages, and arbitrary URLs are not fetched. The request times out after 15 seconds; HTML is capped at 2 MB. Incoming credentials and cookies are never forwarded; fetched sheets are returned with `Cache-Control: no-store`.
- **Text:** Paste or upload chord-over-lyric text, UG `[ch]`/`[tab]` markup, or ChordPro directives and inline chords.
- **Guitar Pro / MusicXML:** Upload a local `.gp3`, `.gp4`, `.gp5`, `.gpx`, `.gp`, `.xml`, or `.musicxml` file. alphaTab previews the original notation. Select a part to import its named chord annotations with that part's capo/tuning. Files without named chords still have a score preview, but cannot become a named chord sheet through this importer. Harmony inference, score editing, score playback, and exporting back to GP are outside this first version.

Transpose chord shapes up/down, select a shape key, choose sharps/flats, and set capo separately. Sounding key is shape key plus capo. Set an unknown original key in the editor. Tablature fret numbers and lyrics are retained, not transposed. The chord guide now combines a bundled catalog of 529 chord entries / 2,069 source positions with a local guitar-voicing generator. Each candidate is checked against actual string pitches, defining chord tones, and the requested slash bass. Equivalent spellings share voicings while the sheet retains its original chord labels. Use the arrows below each diagram to cycle through up to 12 alternatives; click a diagram for a larger view with finger numbers, barre lines, notes, fret values, and any omitted optional tones. Your chosen fingering is saved per song and retained in backups and JSON exports.

Common shapes use the chord catalog; missing/limited shapes and known alternate tunings use generated suggestions. Recognized tuning metadata includes six low-to-high note names (optional octaves), Drop D, and DADGAD. Unknown tunings show an explicit empty state. Shapes remain relative to the capo; higher capo settings restrict the remaining fret range. These are suggested guitar voicings, not the exact voicing from an arbitrary imported GP score.

Generation is bounded to six strings, at most an 18th-fret relative position, a four-fret window, and a four-finger/barre feasibility check. Natural fifths and lower extensions may be omitted where musically appropriate; the expanded view identifies omitted tones. Defining thirds, sevenths, altered fifths, top extensions, roots, and specified bass notes are retained. Unrecognized symbols or unsupported hand positions get an explicit empty state; this is not a claim to every possible chord or fingering.

Open **Settings** in the top bar to choose Sage (the original), Tide, Dusk, or Amber. Each palette has light and dark modes and applies immediately. Theme and mode are saved on this device; existing light/dark preferences migrate to Sage without changing the selected mode. Former UG theme selections fall back to Sage. Settings also holds **Back up library** and **Restore a backup**. Restoring merges songs and preserves existing IDs. Backups contain the song library and each song’s settings/fingerings; device appearance preferences remain separate.

Tap or click any chord in the sheet to open its fingering viewer. Chord-only rows and chord-over-lyric rows both support keyboard activation; the viewer follows the displayed transposition, tuning, capo, and saved fingering. Unsupported diagrams explain why no shape is available. Mobile layouts keep library search, collection selection, and text-size buttons available.

Use the star beside the song actions to favorite a song. The library's **Show** menu switches between all songs, favorites, and individual setlists. Use the adjacent list-plus button to create a setlist, or the song's list-plus button to add/remove it from existing setlists. **Edit setlist** lets you rename it, search/add songs, arrange order with up/down buttons, or remove songs. Save commits the draft; Cancel discards edits. Previous/Next follows the full setlist order even while a library search is active. Deleting a setlist keeps its songs; deleting a song removes its collection references.

Favorites and setlists are saved separately at `open-chords/collections/v1`, so existing song libraries continue to load. Library backups keep the `open-chords-library/v1` schema and include optional `collections` metadata; old backups remain valid. Restore adds missing songs/setlists, unions favorites, and keeps existing setlists (including their current order) on ID collisions. Each setlist contains a song once, and the library supports up to 100 setlists. Appearance preferences remain separate.

Library and preferences are stored in this browser's localStorage and are not synchronized across devices. Export a library backup before clearing site data. Export individual sheets as text, ChordPro, Open Chords JSON, or use Print / Save PDF. Transposed exports carry the displayed chords; library backups retain originals and settings.

## Validation

```sh
npm test
node scripts/validate-artifact.mjs
node tests/fixtures/generate-guitar-pro-demo.mjs
```

`tests/voicings.test.mjs` checks all 41 distinct symbols from the reported screenshots and every semitone transposition against independently specified pitch sets and bass notes, plus fingering/barre constraints, enharmonic equivalence, capo limits, alternate tunings, aliases, and saved selections. `tests/voicings-browser.mjs` exercises the diagrams, alternatives/detail view, persistence/backups, transposition, capo, alternate tuning, and mobile layout.

`tests/link-browser.mjs` checks a live URL import, invalid links, blocked-page fallback, cancellation, attribution/transposition/persistence, and mobile layout. `tests/link-import.test.mjs` covers endpoint behavior, bounded bodies/timeouts, inert parsing, URL validation, and every redirect hop.

`tests/collections.test.mjs` checks organization validation, ordering, orphan cleanup, legacy data, and idempotent merges. `tests/collections-browser.mjs` covers inline chord interactions, mobile controls, favorites/setlist editing/navigation/persistence, and old/new backup restoration.

`tests/appearance.test.mjs` checks preference migration and validation. `tests/settings-browser.mjs` checks every palette/mode, persistence, modal keyboard behavior, backup/restore and visible errors, mobile layouts, and retired-theme migration.

`tests/browser.mjs` exercises desktop/mobile UI, persistence, capo/spelling, paste/edit, downloads, metronome, GP import, and inert HTML import. It uses Playwright and an existing Chromium. Set `CHROMIUM_PATH` to your browser executable if needed; run `npm run dev` first. `tests/ug-bridge.mjs` optionally replays ignored local research bytes to validate the UG bookmark/download/import bridge; it does not visit or claim to test the live site.

## Research and limits

Read [Ultimate Guitar investigation](research/ultimate-guitar.md) and [Guitar Pro interoperability investigation](research/guitar-pro.md) for observations, REA Evidence IDs, source links, and unanswered questions. The UG main bundle was inaccessible (HTTP 403); REA analyzed the actual inline scripts with partial coverage. GP research uses the shipped alphaTab package and an original GP roundtrip fixture; no proprietary Guitar Pro executable was decompiled. Neither investigation claims a complete reconstruction or universal file compatibility.

The browser bookmark relies on an undocumented page-data shape; it can stop working if UG changes it. Paste and saved-page import provide alternatives. The direct-link endpoint fetches one user-selected public sheet; it does not crawl collections or extract paid/blocked scores. Hosting egress can differ from local development, so a link that succeeds locally may be blocked from a hosted server.

## Third-party notices

alphaTab 1.8.1 is distributed unmodified under MPL-2.0; license and copyright headers are retained in `dist/vendor/alphatab`. Source: https://github.com/CoderLine/alphaTab/tree/v1.8.1 . Its Bravura font notices (SIL OFL) are retained with the fonts. No alphaTab soundfont is included. parse5 is used under MIT for inert server-side HTML parsing; its license is bundled at `/licenses/parse5.txt` and the entities parser license at `/licenses/entities.txt`. Demo lyrics are original Open Chords practice material; the original Guitar Pro fixture/generator is CC0-1.0.

The chord catalog is [@tombatossals/chords-db 0.5.1](https://github.com/tombatossals/chords-db), copyright David Rubert, under MIT. Music-theory parsing uses [@tonaljs/chord 6.2.1 and @tonaljs/note 4.12.3](https://github.com/tonaljs/tonal) and their MIT dependencies. The Worker serves the catalog license at `/licenses/chords-db.txt` and the Tonal package notices at `/licenses/tonal-<package>.txt`. Database and theory code are bundled in `dist/vendor/chords/engine.mjs`; no remote per-chord lookup is required.
