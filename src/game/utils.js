import { ROLES } from "./constants.js";

/**
 * Generate a random 4-character room code
 * @returns {string} Uppercase room code
 */
function generateCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * Shuffle an array using Fisher-Yates-like algorithm
 * @param {Array} arr - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
}

/**
 * Create a new deck with 3 copies of each role
 * @returns {Array} Shuffled deck of role cards
 */
function createDeck() {
    let deck = [];
    ROLES.forEach((r) => {
        for (let i = 0; i < 3; i++) deck.push(r);
    });
    return shuffle(deck);
}

export { generateCode, shuffle, createDeck };

