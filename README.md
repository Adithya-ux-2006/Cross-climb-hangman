# Spider-Verse Crossclimb & Hangman

A local, dependency-free Spider-Verse word arcade containing Hangman and Crossclimb.

## What is included

- 120 Hangman words with stable IDs, categories, difficulty levels, and reviewed hints
- 52 rebuilt Crossclimb word ladders using only immediately recognizable everyday vocabulary
- Clear top-to-bottom play from a given starting word to a visible target word
- Progressive hints, clear wrong-answer feedback, completion states, and high-score feedback
- Recent-puzzle memory to reduce repetition
- First-visit Crossclimb instructions and a dismissible `CAT → COT → DOT` example
- Lightweight initial loader, optimized background images, reduced-motion support, and mobile-friendly controls
- Automatic dataset validation

The rebuilt Crossclimb collection is maintained in `crossclimb-data.js`; it is generated independently from the original ladders and is the only Crossclimb dataset loaded by the game.

## Run locally

Open `index.html` directly in a browser, or serve this folder with any simple local web server.

## Validate the datasets

With Node.js installed, run:

```text
npm test
```

The validator checks duplicate IDs, duplicate answers/ladders, missing clues, word-length changes, and every one-letter Crossclimb transition.
