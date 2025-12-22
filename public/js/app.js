let socket = null;
let currentCode = null;
let myId = null;
let gameState = null;
let selectedAction = null;

// Role to image mapping
const roleImages = {
    Duke: "/images/duke.png",
    Assassin: "/images/assassin.png",
    Captain: "/images/captain.png",
    Ambassador: "/images/ambassador.png",
    Contessa: "/images/contessa.png",
};

// Initialize WebSocket connection
function initSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/parties/main/main`;

    socket = new WebSocket(wsUrl);

    socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    });

    socket.addEventListener("open", () => {
        console.log("Connected to PartyKit server");
    });

    socket.addEventListener("close", () => {
        console.log("Disconnected from server");
    });

    socket.addEventListener("error", (e) => {
        console.error("WebSocket error:", e);
    });
}

function handleServerMessage(data) {
    switch (data.type) {
        case "connected":
            myId = data.id;
            break;
        case "joined":
            currentCode = data.code;
            myId = data.id;
            show("lobby-screen");
            document.getElementById("lobby-code").innerText = data.code;
            break;
        case "update":
            gameState = data;
            render(data);
            break;
        case "error":
            alert(data.message);
            break;
    }
}

// Helper function to send messages to server
function emit(type, payload = {}) {
    console.log("emit called:", type, payload, "socket state:", socket?.readyState);
    if (socket && socket.readyState === WebSocket.OPEN) {
        const msg = JSON.stringify({ type, ...payload });
        console.log("Sending:", msg);
        socket.send(msg);
    } else {
        console.error("Socket not ready! State:", socket?.readyState);
    }
}

function show(id) {
    document
        .querySelectorAll(".screen")
        .forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
}

function copyRoomCode() {
    const code = document.getElementById("lobby-code").innerText;
    const copyBtn = document.querySelector(".copy-btn");

    navigator.clipboard
        .writeText(code)
        .then(() => {
            copyBtn.innerHTML = "✓";
            copyBtn.classList.add("copied");

            setTimeout(() => {
                copyBtn.innerHTML = "📋";
                copyBtn.classList.remove("copied");
            }, 2000);
        })
        .catch((err) => {
            const textArea = document.createElement("textarea");
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);

            copyBtn.innerHTML = "✓";
            copyBtn.classList.add("copied");
            setTimeout(() => {
                copyBtn.innerHTML = "📋";
                copyBtn.classList.remove("copied");
            }, 2000);
        });
}

function openCheatsheet() {
    document
        .getElementById("cheatsheet-modal")
        .classList.add("active");
}

function closeCheatsheet() {
    document
        .getElementById("cheatsheet-modal")
        .classList.remove("active");
}

document
    .getElementById("cheatsheet-modal")
    .addEventListener("click", function (e) {
        if (e.target === this) {
            closeCheatsheet();
        }
    });

function createGame() {
    const name = document.getElementById("create-name").value;
    if (name) emit("createRoom", { name });
}

function joinGame() {
    const name = document.getElementById("join-name").value;
    const code = document
        .getElementById("join-code")
        .value.toUpperCase();
    if (name && code) emit("joinRoom", { code, name });
}

function createCardElement(
    card,
    isSelectable = false,
    onClick = null,
) {
    const div = document.createElement("div");

    if (card.revealed) {
        div.className = "card revealed";
        div.setAttribute("data-role", card.role);

        const img = document.createElement("img");
        img.className = "card-logo";
        img.src = roleImages[card.role];
        img.alt = card.role;
        div.appendChild(img);

        const name = document.createElement("span");
        name.className = "card-name";
        name.textContent = card.role;
        div.appendChild(name);
    } else if (card.role === "HIDDEN") {
        div.className = "card hidden";
    } else {
        div.className = "card";
        div.setAttribute("data-role", card.role);

        const img = document.createElement("img");
        img.className = "card-logo";
        img.src = roleImages[card.role];
        img.alt = card.role;
        div.appendChild(img);

        const name = document.createElement("span");
        name.className = "card-name";
        name.textContent = card.role;
        div.appendChild(name);

        if (isSelectable) {
            div.classList.add("selectable");
            div.onclick = onClick;
        }
    }

    return div;
}

function getActionNotificationInfo(room, me) {
    const act = room.currentAction;

    if (me.isEliminated) {
        return {
            text: "You have been eliminated",
            notifyClass: "notify-neutral",
        };
    }

    if (room.state === "GAME_OVER") {
        const winner = room.players.find((p) => !p.isEliminated);
        return {
            text: winner
                ? `${winner.name} wins the game!`
                : "Game ended",
            notifyClass: "notify-neutral",
        };
    }

    if (room.state === "PLAYING") {
        const currentPlayer = room.players[room.turnIndex];
        if (currentPlayer.id === myId) {
            return {
                text: "Your turn — choose an action",
                notifyClass: "notify-neutral",
            };
        } else {
            return {
                text: `Waiting for ${currentPlayer.name} to act...`,
                notifyClass: "notify-neutral",
            };
        }
    }

    if (!act) return null;

    const source = room.players.find((p) => p.id === act.sourceId);
    const target = act.targetId
        ? room.players.find((p) => p.id === act.targetId)
        : null;
    const blocker = act.blockerId
        ? room.players.find((p) => p.id === act.blockerId)
        : null;

    let text = "";
    let notifyClass = "notify-neutral";

    if (room.state === "WAITING_ACTION_RESPONSE") {
        const actionName = act.type.replace("_", " ").toLowerCase();
        if (target) {
            text = `${source?.name || "Someone"} used ${actionName} on ${target.name}`;
        } else {
            text = `${source?.name || "Someone"} used ${actionName}`;
        }

        switch (act.type) {
            case "TAX":
                notifyClass = "notify-duke";
                break;
            case "ASSASSINATE":
                notifyClass = "notify-assassin";
                break;
            case "STEAL":
                notifyClass = "notify-captain";
                break;
            case "EXCHANGE":
                notifyClass = "notify-ambassador";
                break;
            default:
                notifyClass = "notify-neutral";
        }
    } else if (room.state === "WAITING_BLOCK_RESPONSE") {
        const blockRole = act.blockRole;
        text = `${blocker?.name || "Someone"} blocked with ${blockRole}`;

        switch (blockRole) {
            case "Duke":
                notifyClass = "notify-duke";
                break;
            case "Captain":
                notifyClass = "notify-captain";
                break;
            case "Ambassador":
                notifyClass = "notify-ambassador";
                break;
            case "Contessa":
                notifyClass = "notify-contessa";
                break;
            default:
                notifyClass = "notify-neutral";
        }
    } else if (
        room.state === "RESOLVING_CHALLENGE" &&
        room.challenge
    ) {
        const challenger = room.players.find(
            (p) => p.id === room.challenge.challengerId,
        );
        const accused = room.players.find(
            (p) => p.id === room.challenge.accusedId,
        );
        const claimedRole = room.challenge.role;
        text = `${challenger?.name || "Someone"} challenges ${accused?.name || "someone"}'s ${claimedRole}`;

        switch (claimedRole) {
            case "Duke":
                notifyClass = "notify-duke";
                break;
            case "Assassin":
                notifyClass = "notify-assassin";
                break;
            case "Captain":
                notifyClass = "notify-captain";
                break;
            case "Ambassador":
                notifyClass = "notify-ambassador";
                break;
            case "Contessa":
                notifyClass = "notify-contessa";
                break;
            default:
                notifyClass = "notify-neutral";
        }
    } else if (
        room.state === "LOSE_INFLUENCE" &&
        room.pendingLoss.length > 0
    ) {
        const loser = room.players.find(
            (p) => p.id === room.pendingLoss[0].playerId,
        );
        text = `${loser?.name || "Someone"} must reveal a card`;
        notifyClass = "notify-neutral";
    } else if (room.state === "EXCHANGE_CARDS") {
        text = `${source?.name || "Someone"} is choosing cards to keep`;
        notifyClass = "notify-ambassador";
    } else {
        return null;
    }

    return { text, notifyClass };
}

function updateActionNotification(room, me) {
    const notifEl = document.getElementById("action-notification");
    const info = getActionNotificationInfo(room, me);

    if (info) {
        notifEl.querySelector(".action-text").textContent =
            info.text;
        notifEl.className =
            "action-notification active " + info.notifyClass;
    } else {
        notifEl.classList.remove("active");
    }
}

function render(room) {
    if (room.state === "LOBBY") {
        show("lobby-screen");
        document.getElementById("lobby-list").innerHTML =
            room.players
                .map((p) => `<div>${p.name}</div>`)
                .join("");
        if (room.players[0].id === myId)
            document.getElementById("start-btn").style.display =
                "inline-block";
        return;
    }

    show("game-screen");
    const me = room.players.find((p) => p.id === myId);

    updateActionNotification(room, me);

    document.getElementById("players").innerHTML = room.players
        .filter((p) => p.id !== myId)
        .map(
            (p) => `
    <div class="player ${room.players[room.turnIndex].id === p.id ? "turn" : ""} ${p.isEliminated ? "eliminated" : ""}">
        <div class="player-name">${p.name} ${!p.connected ? "(🔴)" : ""}</div>
        <div class="player-stats">
            Coins: ${p.coins} | Cards: ${p.hand.filter((c) => !c.revealed).length}
        </div>
        <div style="margin-top:5px">
            ${p.hand
                    .filter((c) => c.revealed)
                    .map(
                        (c) =>
                            `<span style="font-size:0.7em; color:var(--text-muted)">[${c.role}]</span>`,
                    )
                    .join(" ")}
        </div>
    </div>
`,
        )
        .join("");

    document.getElementById("my-name").innerText = me.name;
    document.getElementById("my-coins").innerText = me.coins;

    const hDiv = document.getElementById("my-hand");
    hDiv.innerHTML = "";
    me.hand.forEach((c, idx) => {
        const isSelectable =
            !c.revealed &&
            ((room.state === "RESOLVING_CHALLENGE" &&
                room.challenge.accusedId === myId) ||
                (room.state === "LOSE_INFLUENCE" &&
                    room.pendingLoss[0]?.playerId === myId));

        const cardEl = createCardElement(c, isSelectable, () => {
            emit("chooseCard", {
                code: currentCode,
                index: idx,
            });
        });
        hDiv.appendChild(cardEl);
    });

    const lDiv = document.getElementById("logs");
    lDiv.innerHTML = room.logs
        .map((l) => `<div>${l}</div>`)
        .join("");
    lDiv.scrollTop = lDiv.scrollHeight;

    renderControls(room, me);

    if (
        room.state === "EXCHANGE_CARDS" &&
        room.currentAction.sourceId === myId
    )
        renderExchange(me.hand, room.currentAction.tempCards);
    else
        document.getElementById("exchange-modal").style.display =
            "none";
}

function renderControls(room, me) {
    const cDiv = document.getElementById("controls");
    cDiv.innerHTML = "";

    if (room.state === "GAME_OVER") {
        if (room.players[0].id === myId) {
            const btn = document.createElement("button");
            btn.className = "btn btn-neutral w-100";
            btn.innerText = "Play Again";
            btn.onclick = () =>
                emit("playAgain", { code: currentCode });
            cDiv.appendChild(btn);
        } else {
            cDiv.innerHTML =
                '<div style="width:100%; text-align:center; color:var(--text-muted)">Waiting for host...</div>';
        }
        return;
    }

    if (me.isEliminated) return;

    if (
        room.state === "PLAYING" &&
        room.players[room.turnIndex].id === myId
    ) {
        const actions = [
            { id: "INCOME", t: "Income", cls: "btn-neutral" },
            {
                id: "FOREIGN_AID",
                t: "Foreign Aid",
                cls: "btn-neutral",
            },
            {
                id: "COUP",
                t: "Coup",
                cls: "btn-neutral",
                cost: 7,
                target: true,
            },
            { id: "TAX", t: "Tax", cls: "btn-duke" },
            {
                id: "ASSASSINATE",
                t: "Assassinate",
                cls: "btn-assassin",
                cost: 3,
                target: true,
            },
            {
                id: "EXCHANGE",
                t: "Exchange",
                cls: "btn-ambassador",
            },
            {
                id: "STEAL",
                t: "Steal",
                cls: "btn-captain",
                target: true,
            },
        ];

        actions.forEach((a) => {
            const btn = document.createElement("button");
            btn.className = `btn ${a.cls}`;
            btn.innerText = a.t;
            if (me.coins >= 10 && a.id !== "COUP")
                btn.disabled = true;
            if (a.cost && me.coins < a.cost) btn.disabled = true;

            btn.onclick = () => {
                if (a.target) showTarget(a.id);
                else
                    emit("action", {
                        code: currentCode,
                        actionType: a.id,
                    });
            };
            cDiv.appendChild(btn);
        });
    } else if (
        room.state === "WAITING_ACTION_RESPONSE" ||
        room.state === "WAITING_BLOCK_RESPONSE"
    ) {
        const act = room.currentAction;
        const isActor = act.sourceId === myId;
        const isBlocker = act.blockerId === myId;
        const hasVoted = act.votes.includes(myId);

        if (hasVoted) {
            cDiv.innerHTML =
                '<div style="width:100%; text-align:center; color:var(--text-muted); font-size:0.85em;">Waiting for others...</div>';
            return;
        }

        if (room.state === "WAITING_BLOCK_RESPONSE") {
            if (isBlocker) {
                cDiv.innerHTML =
                    '<div style="width:100%; text-align:center; color:var(--text-muted); font-size:0.85em;">Waiting for response...</div>';
                return;
            }
            const btnPass = document.createElement("button");
            btnPass.className = "btn btn-neutral";
            btnPass.innerText = isActor ? "Accept Block" : "Pass";
            btnPass.onclick = () =>
                emit("response", {
                    code: currentCode,
                    response: "PASS",
                });
            cDiv.appendChild(btnPass);

            const btnChal = document.createElement("button");
            btnChal.className = "btn btn-neutral";
            btnChal.innerText = "Challenge";
            btnChal.onclick = () =>
                emit("response", {
                    code: currentCode,
                    response: "CHALLENGE",
                });
            cDiv.appendChild(btnChal);
        } else {
            if (isActor) {
                cDiv.innerHTML =
                    '<div style="width:100%; text-align:center; color:var(--text-muted); font-size:0.85em;">Waiting for opponents...</div>';
                return;
            }

            const btnPass = document.createElement("button");
            btnPass.className = "btn btn-neutral";
            btnPass.innerText = "Pass";
            btnPass.onclick = () =>
                emit("response", {
                    code: currentCode,
                    response: "PASS",
                });
            cDiv.appendChild(btnPass);

            if (
                [
                    "TAX",
                    "ASSASSINATE",
                    "STEAL",
                    "EXCHANGE",
                ].includes(act.type)
            ) {
                const btnChal = document.createElement("button");
                btnChal.className = "btn btn-neutral";
                btnChal.innerText = "Challenge";
                btnChal.onclick = () =>
                    emit("response", {
                        code: currentCode,
                        response: "CHALLENGE",
                    });
                cDiv.appendChild(btnChal);
            }

            let blockRoles = [];
            if (act.type === "FOREIGN_AID") {
                blockRoles = ["Duke"];
            } else if (
                act.type === "STEAL" &&
                act.targetId === myId
            ) {
                blockRoles = ["Captain", "Ambassador"];
            } else if (
                act.type === "ASSASSINATE" &&
                act.targetId === myId
            ) {
                blockRoles = ["Contessa"];
            }

            blockRoles.forEach((r) => {
                const btn = document.createElement("button");
                let cls = "btn-neutral";
                if (r === "Duke") cls = "btn-duke";
                if (r === "Captain") cls = "btn-captain";
                if (r === "Ambassador") cls = "btn-ambassador";
                if (r === "Contessa") cls = "btn-contessa";
                btn.className = `btn ${cls}`;
                btn.innerText = `Block (${r})`;
                btn.onclick = () =>
                    emit("response", {
                        code: currentCode,
                        response: "BLOCK",
                        extra: r,
                    });
                cDiv.appendChild(btn);
            });
        }
    }
}

function showTarget(type) {
    selectedAction = type;
    const div = document.getElementById("target-btns");
    div.innerHTML = "";
    gameState.players.forEach((p) => {
        if (p.id !== myId && !p.isEliminated) {
            const btn = document.createElement("button");
            btn.className = "btn btn-neutral w-100";
            btn.innerText = p.name;
            btn.onclick = () => {
                emit("action", {
                    code: currentCode,
                    actionType: selectedAction,
                    targetId: p.id,
                });
                closeModal("target-modal");
            };
            div.appendChild(btn);
        }
    });
    document.getElementById("target-modal").style.display = "flex";
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

function renderExchange(hand, temp) {
    const div = document.getElementById("exchange-cards");
    div.innerHTML = "";
    const pool = [
        ...hand.filter((c) => !c.revealed).map((c) => c.role),
        ...temp,
    ];

    const handSize = gameState.players
        .find((p) => p.id === myId)
        .hand.filter((c) => !c.revealed).length;
    document.getElementById("exchange-title").innerText =
        `Keep ${handSize} Card${handSize > 1 ? "s" : ""}`;

    pool.forEach((r) => {
        const cardEl = createCardElement({
            role: r,
            revealed: false,
        });
        cardEl.onclick = () => {
            cardEl.classList.toggle("selected");
        };
        div.appendChild(cardEl);
    });
    document.getElementById("exchange-modal").style.display =
        "flex";
}

function submitExchange() {
    const selected = Array.from(
        document.querySelectorAll("#exchange-cards .card.selected"),
    ).map((e) => e.querySelector(".card-name").textContent);
    const handSize = gameState.players
        .find((p) => p.id === myId)
        .hand.filter((c) => !c.revealed).length;
    if (selected.length !== handSize)
        return alert(`Select exactly ${handSize} cards!`);
    emit("exchange", { code: currentCode, roles: selected });
}

// Start button handler - need to update for PartySocket
function startGame() {
    emit("start", { code: currentCode });
}

// Initialize socket on page load
window.addEventListener("DOMContentLoaded", () => {
    initSocket();

    // Update start button to use new function
    const startBtn = document.getElementById("start-btn");
    if (startBtn) {
        startBtn.onclick = startGame;
    }
});
