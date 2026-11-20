# Guitar Pro interoperability investigation

Investigated 2026-11-14. Scope: identify a practical path for importing user-supplied Guitar Pro files into Open Chords. No proprietary Guitar Pro executable, paid score, account session, or access control was selected or analyzed. This is interoperability research on the shipped alphaTab npm package and primary documentation, not a reconstruction of the Guitar Pro desktop application.

## Findings

| Question | Finding and evidence | Status |
| --- | --- | --- |
| Which file families? | `.gp3`, `.gp4`, `.gp5` are binary formats; `.gpx` uses a custom archive with XML; `.gp` (GP7/8) uses ZIP with XML. Supported by alphaTab importers according to its [introduction](https://alphatab.net/docs/introduction/) and [format documentation](https://alphatab.net/docs/formats/guitar-pro-3-5). Guitar Pro's [official batch converter guide](https://www.guitar-pro.com/docs/gp8/import-export/import/batch-converter) confirms legacy extensions and current `.gp`. | Answered from primary documentation; not each extension exercised locally. |
| Can we load uploaded bytes? | `importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(await file.arrayBuffer()))` returns a score. Shipped `dist/alphaTab.core.mjs:54895` implements importer dispatch by trying each importer against reset bytes; unsupported formats are skipped and other import errors propagate. [Official API](https://alphatab.net/docs/reference/types/importer/scoreloader/). Synthetic `.gp` roundtrip below confirms behavior. | Answered. |
| Where are actual chord annotations? | `score.tracks → track.staves → staff.bars → bar.voices → voice.beats`; `beat.chord?.name` resolves the beat's `chordId` through `staff.getChord`. `staff.chords` is a `Map<string, Chord>`. Observed in the shipped core at lines 7520–7525, 12180 onward, and 12722 onward. [Beat API](https://alphatab.net/docs/reference/types/model/beat/), [Staff API](https://alphatab.net/docs/reference/types/model/staff/). | Answered. |
| Can all GP tabs become lyric/chord sheets? | No such guarantee: GP files can contain notes and effects without named chord annotations or lyrics. The binary importer's `readChord` records an annotation only if it has a name (`dist/alphaTab.core.mjs:20359–20452`). Extract existing annotations; show a clear empty state when absent. Preserve notes for notation preview. Do not invent chords from bass notes. | Answered within the inspected importer; chord inference not implemented or validated. |
| Capo/tuning? | Metadata belongs to each staff: `staff.capo`, `staff.stringTuning.name`, `staff.stringTuning.tunings`, `staff.isPercussion`. Tunings are MIDI pitches in tablature display order, highest line/string first. Chord diagram `chord.strings` uses the same high-to-low order; `-1` is muted. Confirmed by declarations and synthetic roundtrip. | Answered. |
| Transposition? | The [public setting](https://alphatab.net/docs/reference/settings/notation/transpositionpitches/) `settings.notation.transpositionPitches` applies per-track semitone offsets to rendering and playback. [displayTranspositionPitches](https://alphatab.net/docs/reference/settings/notation/displaytranspositionpitches/) affects display alone. Chord names are stored strings, so our chord-sheet layer should transpose parsed labels independently. Do not assume pitch shifting automatically renames those labels or finds playable new fingerings. | Public API established; playback and fingering changes not exercised here. |
| Export? | `new exporter.Gp7Exporter().export(score)` returns bytes. Shipped core at line 80722 writes a ZIP with `VERSION` = `7.0`, `Content/score.gpif`, stylesheet and layout entries. Used for the original test fixture. Export fidelity for arbitrary user files remains untested. | Synthetic export/import confirmed. |

## REA evidence and limitations

Selected target: installed `@coderline/alphatab@1.8.1` at `node_modules/@coderline/alphatab`.

- REA parent application evidence: `ev_0485caab338dcb06346c515e41fbd3a13391db152246c0b1bc8546f8605e0ea7`.
- REA summary view: `ev_1156e36be9307dd217e3dc8004ec4f822fec24e54ae4b93d66e19a8e2507da3b`.
- REA retained core asset view: `ev_fb25cfbc6a3e3e13b2718d55ead9975aaa194eac12f02327b00f84bb812d442e`, saved as [guitar-pro-rea-core.json](./guitar-pro-rea-core.json).
- Package inventory digest: `7ae8a12635f4736bc019d9a7e4a65ae4f970d0387e92b17b893ca42130a9daf9`.
- Core asset SHA-256: `e78a5d2d7eaa56106a61bcfd91ac725e8f4b6f078726bc83e71189a5ca0224d8`; 3,173,567 bytes. REA observed its bytes and completed syntax parsing.

REA parsed 19 JavaScript files (20 relevant files; about 9.5 MB text). Application and semantic coverage are **partial**: the isolated 1 GiB workers exhausted their heap while analyzing semantic relationships in four large core/UMD bundles. There were four application unknowns and 405 semantic unknowns. REA did not execute code and did not establish end-to-end callable behavior. API findings above additionally use focused manual inspection of those exact shipped bytes, official docs, and an explicitly executed Node roundtrip. They must not be attributed to a complete REA call graph.

## Original executable probe

Run `node tests/fixtures/generate-guitar-pro-demo.mjs` from the project root. This creates `tests/fixtures/original-demo.gp` using alphaTab, then imports the exported bytes with the public loader. The composition and generator are original synthetic test material dedicated to the public domain (CC0-1.0), with four quarter-note chord voicings and named annotations; they contain no Ultimate Guitar material.

Observed output: title `Open Chords GP Demo`; capo `2`; tuning `[64,59,55,50,45,40]`; chord annotations `C`, `G/B`, `Am7`, `Fmaj7`; file length `3700` bytes. Fixture SHA-256: `641b43ae2fa40fea9f10d0f9f7cf7f1eb8271e6fa85784a206454e925e9c3e30`.

This probe validates one current-family GP file generated by the same library. It does not establish compatibility with all real-world GP files, older binary generations, password-protected material, proprietary audio engines, or complete roundtrip fidelity.

## Integration and assets

Use the npm package's public exports (`importer`, `exporter`, `model`, `AlphaTabApi`). Preserve per-track/staff context when extracting annotations so simultaneous voices and instrument-specific capos are not conflated. For notation preview, render the original score rather than reducing it to chord labels.

The shipped package declares MPL-2.0 in `package.json` and includes its license. The Bravura font is distributed with `dist/font/Bravura-OFL.txt`; preserve the accompanying notices if copying fonts to public assets. The bundled SONiVOX soundfont has its own copyright and Apache-2.0 license at `dist/soundfont/LICENSE`; retain it if adding playback assets. Basic chord extraction does not need font or soundfont downloads. These asset observations describe shipped notices, not a legal opinion.
