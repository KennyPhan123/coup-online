import { ACTIONS } from "./constants.js";
import { shuffle, createDeck } from "./utils.js";

class Game {
    constructor(code, hostId, hostName) {
        this.code = code;
        this.players = [
            {
                id: hostId,
                name: hostName,
                coins: 2,
                hand: [],
                isEliminated: false,
                connected: true,
            },
        ];
        this.deck = [];
        this.state = "LOBBY";
        this.turnIndex = 0;
        this.logs = [];

        this.currentAction = null;
        this.challenge = null;
        this.pendingLoss = [];
        this.resumeAction = false;
    }

    addPlayer(id, name) {
        if (this.state !== "LOBBY" || this.players.length >= 6) return false;
        this.players.push({
            id,
            name,
            coins: 2,
            hand: [],
            isEliminated: false,
            connected: true,
        });
        return true;
    }

    start() {
        if (this.players.length < 2) return false;
        this.resetGameData();
        this.state = "PLAYING";
        this.turnIndex = Math.floor(Math.random() * this.players.length);
        this.log(`Game started! Turn: ${this.getCurrentPlayer().name}`);
        return true;
    }

    resetGameData() {
        this.deck = createDeck();
        this.players.forEach((p) => {
            p.coins = 2;
            p.hand = [
                { role: this.deck.pop(), revealed: false },
                { role: this.deck.pop(), revealed: false },
            ];
            p.isEliminated = false;
        });
        this.currentAction = null;
        this.challenge = null;
        this.pendingLoss = [];
        this.resumeAction = false;
        this.logs = [];
    }

    handleAction(playerId, type, targetId) {
        const p = this.getPlayer(playerId);
        if (this.state !== "PLAYING" || p.id !== this.getCurrentPlayer().id)
            return;

        const def = ACTIONS[type];
        if (p.coins >= 10 && type !== "COUP") return;
        if (p.coins < def.cost) return;

        if (def.cost > 0) p.coins -= def.cost;

        this.currentAction = {
            type,
            sourceId: playerId,
            targetId,
            cost: def.cost,
            votes: [],
            blockerId: null,
            blockRole: null,
        };
        this.resumeAction = false;

        const targetName = targetId
            ? ` on ${this.getPlayer(targetId).name}`
            : ``;
        this.log(`${p.name} used ${type}${targetName}`);

        if (!def.blockable && !def.challengeable) {
            if (type === "COUP") this.queueLoss(targetId, 1);
            else this.resolveAction();
        } else {
            this.state = "WAITING_ACTION_RESPONSE";
        }
    }

    handleResponse(playerId, response, extra) {
        if (!this.currentAction) return;
        const p = this.getPlayer(playerId);
        if (p.isEliminated) return;

        if (response === "PASS") {
            if (!this.currentAction.votes.includes(playerId)) {
                this.currentAction.votes.push(playerId);
            }

            const activePlayers = this.players.filter(
                (pl) => !pl.isEliminated && pl.connected,
            );
            let needed = activePlayers.length - 1;

            if (this.currentAction.votes.length >= needed) {
                if (this.state === "WAITING_ACTION_RESPONSE") {
                    this.resolveAction();
                } else if (this.state === "WAITING_BLOCK_RESPONSE") {
                    this.log(`Block successful.`);
                    this.nextTurn();
                }
            }
        } else if (response === "CHALLENGE") {
            if (this.state === "WAITING_ACTION_RESPONSE") {
                const role = ACTIONS[this.currentAction.type].role;
                if (!role) return;
                this.initChallenge(
                    playerId,
                    this.currentAction.sourceId,
                    role,
                    false,
                );
            } else if (this.state === "WAITING_BLOCK_RESPONSE") {
                this.initChallenge(
                    playerId,
                    this.currentAction.blockerId,
                    this.currentAction.blockRole,
                    true,
                );
            }
        } else if (response === "BLOCK") {
            if (this.state !== "WAITING_ACTION_RESPONSE") return;
            const def = ACTIONS[this.currentAction.type];
            if (!def.blockable) return;

            if (
                this.currentAction.type !== "FOREIGN_AID" &&
                playerId !== this.currentAction.targetId
            )
                return;

            this.currentAction.blockerId = playerId;
            this.currentAction.blockRole = extra;
            this.currentAction.votes = [];
            this.state = "WAITING_BLOCK_RESPONSE";
            this.log(`${p.name} blocked with ${extra}.`);
        }
    }

    initChallenge(challengerId, accusedId, role, isBlockChallenge) {
        this.state = "RESOLVING_CHALLENGE";
        this.challenge = { challengerId, accusedId, role, isBlockChallenge };
        this.log(
            `${this.getPlayer(challengerId).name} CHALLENGED ${this.getPlayer(accusedId).name} (claims ${role})!`,
        );
    }

    resolveChallenge(cardIndex) {
        const accused = this.getPlayer(this.challenge.accusedId);
        const card = accused.hand[cardIndex];
        const challenger = this.getPlayer(this.challenge.challengerId);
        const isBlockChallenge = this.challenge.isBlockChallenge;

        if (card.role === this.challenge.role) {
            this.log(
                `${accused.name} HAS ${card.role}! ${challenger.name} lost.`,
            );
            accused.hand[cardIndex] = {
                role: this.deck.pop(),
                revealed: false,
            };
            this.deck.push(card.role);
            this.deck = shuffle(this.deck);

            this.queueLoss(challenger.id, 1);
            this.resumeAction = !isBlockChallenge;
        } else {
            this.log(
                `${accused.name} DOES NOT HAVE ${this.challenge.role}! Caught bluffing.`,
            );
            card.revealed = true;
            this.checkElimination(accused);

            if (isBlockChallenge) {
                this.resumeAction = true;
            } else {
                this.resumeAction = false;
                this.log(`Action failed. Coins refunded.`);
                const source = this.getPlayer(this.currentAction.sourceId);
                if (source) source.coins += this.currentAction.cost;
            }
            this.checkResumeAfterChallenge();
        }
    }

    checkResumeAfterChallenge() {
        if (this.pendingLoss.length > 0) {
            // Wait
        } else {
            if (this.resumeAction) this.resolveAction();
            else if (this.state !== "GAME_OVER") this.nextTurn();
        }
    }

    resolveAction() {
        const act = this.currentAction;
        if (!act) return;
        const source = this.getPlayer(act.sourceId);
        const target = act.targetId ? this.getPlayer(act.targetId) : null;

        if (!source || source.isEliminated) {
            this.nextTurn();
            return;
        }

        switch (act.type) {
            case "INCOME":
                source.coins++;
                break;
            case "FOREIGN_AID":
                source.coins += 2;
                break;
            case "TAX":
                source.coins += 3;
                break;
            case "STEAL":
                if (target && !target.isEliminated) {
                    const stolen = Math.min(2, target.coins);
                    target.coins -= stolen;
                    source.coins += stolen;
                    this.log(
                        `${source.name} stole ${stolen} coins from ${target.name}.`,
                    );
                }
                break;
            case "ASSASSINATE":
                if (target && !target.isEliminated) {
                    this.log(`${target.name} was assassinated!`);
                    this.queueLoss(target.id, 1);
                    return;
                }
                break;
            case "EXCHANGE":
                this.state = "EXCHANGE_CARDS";
                act.tempCards = [this.deck.pop(), this.deck.pop()];
                this.log(`${source.name} is exchanging cards...`);
                return;
        }

        if (this.pendingLoss.length === 0) this.nextTurn();
    }

    handleExchange(playerId, keptRoles) {
        const p = this.getPlayer(playerId);
        const act = this.currentAction;
        if (this.state !== "EXCHANGE_CARDS" || act.sourceId !== playerId)
            return;

        const handSize = p.hand.filter((c) => !c.revealed).length;
        if (keptRoles.length !== handSize) return;

        let pool = [
            ...p.hand.filter((c) => !c.revealed).map((c) => c.role),
            ...act.tempCards,
        ];
        let valid = true;
        let tempPool = [...pool];
        keptRoles.forEach((r) => {
            const idx = tempPool.indexOf(r);
            if (idx > -1) tempPool.splice(idx, 1);
            else valid = false;
        });

        if (!valid) return;

        let newHand = [];
        p.hand.filter((c) => c.revealed).forEach((c) => newHand.push(c));
        keptRoles.forEach((r) => newHand.push({ role: r, revealed: false }));

        tempPool.forEach((r) => this.deck.push(r));
        this.deck = shuffle(this.deck);
        p.hand = newHand;

        this.log(`${p.name} exchanged cards.`);
        this.nextTurn();
    }

    queueLoss(playerId, count) {
        const p = this.getPlayer(playerId);
        if (!p || p.isEliminated) return;

        const alive = p.hand.filter((c) => !c.revealed).length;
        if (alive <= count) {
            p.hand.forEach((c) => (c.revealed = true));
            this.checkElimination(p);
            this.checkResumeAfterChallenge();
        } else {
            this.pendingLoss.push({ playerId, count });
            this.state = "LOSE_INFLUENCE";
        }
    }

    handleCardLoss(playerId, cardIndex) {
        const task = this.pendingLoss[0];
        if (!task || task.playerId !== playerId) return;

        const p = this.getPlayer(playerId);
        if (p.hand[cardIndex].revealed) return;

        p.hand[cardIndex].revealed = true;
        this.log(`${p.name} revealed ${p.hand[cardIndex].role}.`);
        this.checkElimination(p);

        task.count--;
        if (task.count <= 0) {
            this.pendingLoss.shift();
            if (this.pendingLoss.length === 0) {
                if (this.state === "LOSE_INFLUENCE") {
                    if (this.resumeAction) this.resolveAction();
                    else this.nextTurn();
                }
            }
        }
    }

    checkElimination(p) {
        if (p.hand.every((c) => c.revealed)) {
            p.isEliminated = true;
            this.log(`${p.name} ELIMINATED.`);
        }
    }

    nextTurn() {
        this.currentAction = null;
        this.challenge = null;
        this.resumeAction = false;
        this.state = "PLAYING";

        let loops = 0;
        do {
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
            loops++;
        } while (
            (this.players[this.turnIndex].isEliminated ||
                !this.players[this.turnIndex].connected) &&
            loops < this.players.length
        );

        const survivors = this.players.filter(
            (p) => !p.isEliminated && p.connected,
        );
        if (survivors.length === 1) {
            this.state = "GAME_OVER";
            this.log(`WINNER: ${survivors[0].name}!!!`);
        }
    }

    handleDisconnect(playerId) {
        const p = this.getPlayer(playerId);
        if (!p) return;
        p.connected = false;
        p.hand.forEach((c) => (c.revealed = true));
        p.isEliminated = true;
        this.log(`${p.name} disconnected.`);
        if (this.state !== "LOBBY" && this.state !== "GAME_OVER")
            this.nextTurn();
        else if (this.state === "LOBBY")
            this.players = this.players.filter((pl) => pl.id !== playerId);
    }

    getPlayer(id) {
        return this.players.find((p) => p.id === id);
    }

    getCurrentPlayer() {
        return this.players[this.turnIndex];
    }

    log(msg) {
        this.logs.push(msg);
        if (this.logs.length > 50) this.logs.shift();
    }

    getSanitizedState(viewerId) {
        const clone = JSON.parse(JSON.stringify(this));
        clone.deck = [];
        clone.players.forEach((p) => {
            if (p.id !== viewerId) {
                p.hand.forEach((c) => {
                    if (!c.revealed) c.role = "HIDDEN";
                });
            }
        });
        if (
            clone.state === "EXCHANGE_CARDS" &&
            clone.currentAction.sourceId !== viewerId
        ) {
            clone.currentAction.tempCards = [];
        }
        return clone;
    }
}

export default Game;
