"use strict";

const { hangmanWords } = require("./game-data.js");
const crossclimbDatabase = require("./crossclimb-data.js");

const rejectedCrossclimbWords = new Set([
  "WARD", "GOAD", "LEST", "RICK", "DAME", "MOTE", "MALT", "MAST", "BOOR", "SLAT", "SINE", "CASK"
]);

function differentLetters(first, second) {
  if (first.length !== second.length) return Number.POSITIVE_INFINITY;
  return [...first].reduce((count, letter, index) => count + (letter !== second[index] ? 1 : 0), 0);
}

function findDuplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function validateHangman(words) {
  const errors = [];
  findDuplicates(words.map((word) => word.id)).forEach((id) => errors.push(`Duplicate Hangman ID: ${id}`));
  findDuplicates(words.map((word) => word.answer)).forEach((answer) => errors.push(`Duplicate Hangman answer: ${answer}`));

  words.forEach((word, index) => {
    const label = word.id || `Hangman entry ${index + 1}`;
    if (!word.id) errors.push(`${label} is missing an ID.`);
    if (!/^[A-Z]+$/.test(word.answer || "")) errors.push(`${label} has an invalid answer.`);
    if (!word.hint || word.hint.trim().length < 20) errors.push(`${label} needs a clear, useful hint.`);
    if (!["Easy", "Medium", "Hard"].includes(word.difficulty)) errors.push(`${label} has invalid difficulty metadata.`);
    if (!word.category) errors.push(`${label} is missing a category.`);
  });

  if (words.length < 100) errors.push(`Hangman needs at least 100 words; found ${words.length}.`);
  return errors;
}

function validateCrossclimb(puzzles) {
  const errors = [];
  findDuplicates(puzzles.map((puzzle) => puzzle.id)).forEach((id) => errors.push(`Duplicate Crossclimb ID: ${id}`));
  findDuplicates(puzzles.map((puzzle) => puzzle.ladder.join(">"))).forEach((path) => errors.push(`Duplicate Crossclimb ladder: ${path}`));

  puzzles.forEach((puzzle, puzzleIndex) => {
    const label = puzzle.id || `Crossclimb puzzle ${puzzleIndex + 1}`;
    if (!puzzle.id) errors.push(`${label} is missing an ID.`);
    if (!puzzle.category) errors.push(`${label} is missing a category.`);
    if (!["Easy", "Medium"].includes(puzzle.difficulty)) errors.push(`${label} has invalid difficulty metadata.`);
    if (!Array.isArray(puzzle.ladder) || puzzle.ladder.length < 3) errors.push(`${label} needs at least three rungs.`);
    if (!Array.isArray(puzzle.clues) || puzzle.clues.length !== puzzle.ladder.length) errors.push(`${label} has missing or extra clues.`);
    if (puzzle.startWord !== puzzle.ladder[0] || puzzle.endWord !== puzzle.ladder[puzzle.ladder.length - 1]) errors.push(`${label} start/end metadata does not match its ladder.`);

    const expectedLength = puzzle.ladder[0]?.length;
    const transitions = puzzle.ladder.length - 1;
    if (puzzle.difficulty === "Easy" && (transitions < 4 || transitions > 6)) errors.push(`${label} has ${transitions} transitions; Easy ladders must have 4–6.`);
    if (puzzle.difficulty === "Medium" && (transitions < 5 || transitions > 8)) errors.push(`${label} has ${transitions} transitions; Medium ladders must have 5–8.`);
    puzzle.ladder.forEach((word, rungIndex) => {
      if (!/^[A-Z]+$/.test(word || "")) errors.push(`${label} rung ${rungIndex + 1} is not an uppercase English word.`);
      if (word.length !== expectedLength) errors.push(`${label} changes word length at rung ${rungIndex + 1}.`);
      if (!puzzle.clues[rungIndex] || puzzle.clues[rungIndex].trim().length < 10) errors.push(`${label} is missing a clear clue for ${word}.`);
      if (rejectedCrossclimbWords.has(word)) errors.push(`${label} uses rejected vocabulary: ${word}.`);
      if (rungIndex > 0) {
        const previous = puzzle.ladder[rungIndex - 1];
        const changes = differentLetters(previous, word);
        if (changes !== 1) errors.push(`${label}: ${previous} -> ${word} changes ${changes} letters instead of exactly one.`);
      }
    });
  });

  if (puzzles.length < 50) errors.push(`Crossclimb needs at least 50 puzzles; found ${puzzles.length}.`);
  return errors;
}

const errors = [...validateHangman(hangmanWords), ...validateCrossclimb(crossclimbDatabase)];

if (errors.length) {
  console.error(`Dataset validation failed with ${errors.length} issue(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Dataset validation passed: ${hangmanWords.length} Hangman words and ${crossclimbDatabase.length} Crossclimb ladders.`);
}
