# Ultimate Guitar import investigation

Investigated 2026-11-14/15. Goal: identify a small interoperable representation for importing a user-selected chord sheet into Open Chords, and distinguish this from reconstructing Ultimate Guitar's application.

## Questions and evidence

| Question | Observation | Status |
| --- | --- | --- |
| Where is the sheet? | One public [Chords page](https://tabs.ultimate-guitar.com/tab/seether/careless-whisper-chords-813581) returned HTTP 200. Its HTML has a `.js-store` element with a JSON `data-content` attribute. `store.page.data.tab_view.wiki_tab.content` is the text sheet. | Answered for this observed page, using an ordinary HTML/JSON parser. |
| What is the text format? | The observed sheet has 86 paired `[ch]...[/ch]` markers and 51 paired `[tab]...[/tab]` wrappers. The content is 3,674 characters. Chord markers label chord tokens; wrappers surround text blocks. Line breaks and visible chord columns matter. | Answered for this sample. No sheet or lyrics reproduced in source, fixtures, or deployment. |
| Which metadata is separate? | `store.page.data.tab` contains song_name, artist_name, tonality_name, username, tab_url, type and version. `tab_view.meta.tuning.value` contains tuning. This sample did not expose a nonempty key or capo. Optional capo handling is defensive; no claim it was observed on this sample. | Answered for enumerated fields; other versions may differ. |
| Can the deployed UI be fully traced? | The main linked browser bundle returned HTTP 403. No retry to bypass that response. Eleven inline scripts from the returned HTML were statically analyzed with REA. Four parse failures and 267 semantic unknowns mean this is partial evidence. | Partially answered; actual main-bundle chord rendering/transposition is unresolved. |
| Can a browser send the sheet to our tool? | Design choice: a locally executed export bookmark reads the embedded data on the page already open, downloads a small Open Chords JSON export, and the user imports it. A saved HTML page and pasted sheet are additional inputs. | Implemented. This is our bridge, not an observed Ultimate Guitar export API. |
| Is there a supported remote API? | No official authenticated API was identified or called in this bounded investigation. We did not establish a stable public API contract. | Unresolved. No backend scraper, mobile API impersonation, login, CAPTCHA handling, bulk crawl, or Pro download route implemented. |

## Artifact identity and REA ledger

- Requested page URL: linked above. Downloaded HTML: 146,691 bytes; SHA-256 `68d4423a3b83618741946db5d7c309fef355850640ed2e301aadf827f4fb53e2`.
- Actual REA operation: `analyze_javascript_application` on the unmodified inline script texts extracted from that page, not on our implementation or a third-party scraper.
- Inline directory digest: `44b31b45cfa69a1695a135fb72aaa31c4f3ba161e1d4cb4505c53de290ac4d10`.
- Parent Evidence: `ev_933e26cc382cb5dcea6d2615cb2490e16ce59136657959d8bc06f03c6be0d642`.
- Summary Evidence: `ev_fd735bf453282bcdd5452a6c569f22c021f6fd4d0df70e8fd873e6db06d84c7f`.
- Module inventory view: `ev_55dbfa3ff186b5acb1cd26bfb78eec89706c7219a2783b365168451f87660ae4`.
- Static observations include inline error-reporting references to `window.UGAPP.trigger`. They do **not** prove that a particular dynamic store object is initialized or available at runtime. The export's `window.UGAPP` fallback remains defensive and unverified against live site execution.
- REA parsed 11 JavaScript files, 14,097 text bytes, and 1,305 AST nodes; four parse failures were retained. The HTML schema observations above came from manual parsing of the downloaded bytes, not from a recovered REA data-flow trace.

Raw page, embedded sheet, and inline scripts remain in ignored `research/ug/` for local reproducibility. They are excluded from source synchronization and deployment. The report and the app's examples contain only original material. No browser session was attached; passive runtime behavior of the actual UG site is unknown.

## Implementation decisions

The application normalizes text to section/lyric/chord/tab rows; transposition changes chord root and slash bass only. Original content is retained for repeatable edits. A capo changes sounding-key display separately from chord shape transposition. Attribution and source URLs accompany JSON, text, and ChordPro exports. HTML is parsed in a detached inert template; imported scripts are never executed.

The importer relies on an observed, undocumented page shape, which can change. When it is missing, an explicit error directs the user to paste visible text. Browser bookmark behavior and site content policies can vary, so saved HTML and copied text remain supported paths. No claim of complete UG reverse engineering or universal version compatibility is made.

## Implemented bridge verification

`tests/ug-bridge.mjs` was executed in Chromium using a controlled replay of the actual retained `.js-store` data. The replay intercepted the selected page URL locally, installed only that JSON into a synthetic DOM, ran our export bookmark, captured its JSON download, and imported it into the local app. Content equality, source URL, author, successful import, and rendered chord/lyric rows passed. No live site scripts, browser session, or live site CSP behavior were exercised.

`research/ultimate-guitar-rea-summary.json` preserves the REA summary view. Application checks: 12 core tests and the desktop/mobile browser workflow passed, including actual SVG score notation.

## Direct-link importer update

A same-origin POST endpoint `/api/import/ultimate-guitar` now accepts a user-pasted sheet URL. It normalizes approved UG hosts to `https://tabs.ultimate-guitar.com`, accepts only `/tab/<artist>/<sheet>-<numeric id>` paths, and rejects credentials/alternate ports. Each manually followed redirect must remain an HTTPS sheet on that exact host; at most three redirects are followed. It sends no user session credentials, enforces a 15-second timeout and 2 MB HTML limit, parses with parse5 without evaluating scripts, and returns only a normalized song with `no-store` caching. Search pages, Pro binary downloads, and access-control handling are not implemented.

The existing static Site was migrated to a Worker with embedded reader assets, preserving project identity, owner-only audience, and browser library keys. The export bookmark/saved-page workflow remains available and opens after a remote import failure.

A live Node fetch of the previously sampled public URL succeeded using the actual endpoint implementation, preserving its 3,674-character sheet, source, title, artist, and author. This establishes local network behavior for one page at the time of testing, not universal or hosted egress compatibility. Source unit tests cover URL restrictions, redirect validation, bounded bodies/timeouts, upstream failures, and normalized metadata. Browser checks separately cover the complete direct-link interaction. No fetched song text is bundled into the application.

### Numeric share-link compatibility

The reported `/tab/1789723` share link was initially rejected by our path validator because it accepted only artist/song-slug paths. The validator now also accepts positive numeric `/tab/<id>` paths, including trailing slashes and tracking parameters, with the same host and redirect restrictions. The sampled short link returned HTTP 200 directly rather than a redirect. Regression coverage includes direct sheet responses, numeric/full-link redirects in both directions, malformed short paths, and rejected private-host redirects.


## Theme reference (2026-11-15)

Inspected the public short-link page `https://tabs.ultimate-guitar.com/tab/1789723` in Chromium (HTTP 200). Its default presentation had a charcoal navigation shell (`#0c0c0e`), a white sheet, main text `#141417`, yellow `#ffd706` pill controls (9999px radius), gray chord highlights, and monospace sheet text. The heading computed to Muse Display Harmony, 44px/400; sheet chords computed to Roboto Mono, 13px/600. These are observations of the current rendered page, separate from the earlier REA inline-script evidence and its coverage limits.

Open Chords' Ultimate Guitar theme matches those surface colors and control/chord treatments while retaining the app's library and practice layout. It uses locally bundled OFL Oswald for a similar condensed heading and system fonts for the UI/sheet; it does not bundle UG's proprietary typefaces, logo, ads, or page content. Light mode follows the observed white-sheet presentation; dark mode is a corresponding Open Chords palette. Other palettes preserve the original design.
