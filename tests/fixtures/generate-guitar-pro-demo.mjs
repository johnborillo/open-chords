// Original synthetic fixture, dedicated to the public domain (CC0-1.0).
// Run with: node tests/fixtures/generate-guitar-pro-demo.mjs
import { writeFileSync } from 'node:fs';
import { exporter, importer, model } from '@coderline/alphatab';

const score = importer.ScoreLoader.loadAlphaTex(String.raw`\title "Open Chords GP Demo" \artist "Open Chords" . 0.6 0.5 0.4 0.3`);
const staff = score.tracks[0].staves[0];
score.tracks[0].name = 'Original annotation demo';
staff.capo = 2;
const definitions = [
  ['C', [0, 1, 0, 2, 3, -1]],
  ['G/B', [3, 0, 0, 0, 2, -1]],
  ['Am7', [0, 1, 0, 2, 0, -1]],
  ['Fmaj7', [0, 1, 2, 3, -1, -1]],
];
for (const [index, [name, strings]] of definitions.entries()) {
  const chord = new model.Chord();
  chord.name = name;
  chord.strings = strings;
  staff.addChord(`original-demo-${index}`, chord);
  const beat = staff.bars[0].voices[0].beats[index];
  beat.chordId = `original-demo-${index}`;
  beat.notes = [];
  for (const [stringIndex, fret] of strings.entries()) {
    if (fret < 0) continue;
    const note = new model.Note();
    note.string = stringIndex + 1;
    note.fret = fret;
    beat.addNote(note);
  }
  beat.text = index === 0 ? 'Original synthetic chord annotations' : '';
}
const bytes = new exporter.Gp7Exporter().export(score);
writeFileSync(new URL('./original-demo.gp', import.meta.url), bytes);
const imported = importer.ScoreLoader.loadScoreFromBytes(bytes);
const importedStaff = imported.tracks[0].staves[0];
console.log(JSON.stringify({
  title: imported.title,
  capo: importedStaff.capo,
  tuning: importedStaff.stringTuning.tunings,
  chords: importedStaff.bars[0].voices[0].beats.map(beat => beat.chord?.name),
  bytes: bytes.length,
}, null, 2));
