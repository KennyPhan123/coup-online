// Game roles
const ROLES = ["Duke", "Assassin", "Captain", "Ambassador", "Contessa"];

// Action definitions with their properties
const ACTIONS = {
    INCOME: { cost: 0, blockable: false, challengeable: false },
    FOREIGN_AID: {
        cost: 0,
        blockable: true,
        challengeable: false,
        blockedBy: ["Duke"],
    },
    COUP: { cost: 7, blockable: false, challengeable: false },
    TAX: { cost: 0, blockable: false, challengeable: true, role: "Duke" },
    ASSASSINATE: {
        cost: 3,
        blockable: true,
        challengeable: true,
        role: "Assassin",
        blockedBy: ["Contessa"],
    },
    STEAL: {
        cost: 0,
        blockable: true,
        challengeable: true,
        role: "Captain",
        blockedBy: ["Captain", "Ambassador"],
    },
    EXCHANGE: {
        cost: 0,
        blockable: false,
        challengeable: true,
        role: "Ambassador",
    },
};

export { ROLES, ACTIONS };

