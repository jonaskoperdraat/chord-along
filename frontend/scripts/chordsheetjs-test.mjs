import * as ChordSheetJS from "chordsheetjs";

const chordSheet = `
{title: Let it be}
{subtitle: ChordSheetJS example version}

{c: A comment above a line with just chords}
[A] [*|] [B]

Without the asterisk, the pipe would end up below the chords
[A] | [B]

{c: And without the angled brackets, official chordpro will fail, claiming it doesn't recognize the chord, but chordprojs apparently doesn't check chord names, so it doesn't fail.}
[A] [|] [B]

Some line without chords

{start_of_chorus: Chorus}
Let it [Am]be, let it [C/G]be, let it [F]be, let it [C]be
[C]Whisper words of [G]wisdom, let it [F]be [C/E] [Dm] [C]
{end_of_chorus}`.substring(1);

const parser = new ChordSheetJS.ChordProParser();
const song = parser.parse(chordSheet);

const formatter = new ChordSheetJS.TextFormatter();
const disp = formatter.format(song);

console.log(disp);