Fonts for the languages in `assets/js/languages.js`.

The built-in scripts load free Google Fonts and need nothing here. To write
a language in a font of your own (Espruar, Iokharic, Dethek …), put the
`.woff2` or `.ttf` file in this folder and point that script's entry at it:

    espruar: { label: "Espruar", family: "Espruar", src: "assets/fonts/espruar.woff2" }

Check the font's licence allows putting it on a public website.
