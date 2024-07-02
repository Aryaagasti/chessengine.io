const express = require("express");
const expressSession = require("express-session");
const dotenv = require("dotenv");
const http = require("http");
const { Chess } = require("chess.js");
const socket = require("socket.io");
const path = require("path");

dotenv.config({
    path: './.env'
});

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {};
let playerNames = {};
let currentPlayer = 'w';

app.use(expressSession({
    secret: "mysession",
    resave: false,
    saveUninitialized: false
}));

app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

io.on("connection", (uniquesocket) => {
    console.log("connected");

    if (!players.white) {
        players.white = uniquesocket.id;
        playerNames[uniquesocket.id] = "Player 1";
        uniquesocket.emit("playerRole", { role: "w", player: "Player 1" });
    } else if (!players.black) {
        players.black = uniquesocket.id;
        playerNames[uniquesocket.id] = "Player 2";
        uniquesocket.emit("playerRole", { role: "b", player: "Player 2" });
        io.emit("status", { player1: true, player2: true });
    } else {
        uniquesocket.emit("spectatorRole");
    }

    uniquesocket.on("disconnect", () => {
        if (uniquesocket.id === players.white) {
            delete players.white;
            delete playerNames[uniquesocket.id];
            io.emit("status", { player1: false, player2: !!players.black });
        } else if (uniquesocket.id === players.black) {
            delete players.black;
            delete playerNames[uniquesocket.id];
            io.emit("status", { player1: !!players.white, player2: false });
        }
    });

    uniquesocket.on("move", (move) => {
        try {
            if (chess.turn() === 'w' && uniquesocket.id !== players.white) return;
            if (chess.turn() === 'b' && uniquesocket.id !== players.black) return;

            const res = chess.move(move);
            if (res) {
                currentPlayer = chess.turn();
                io.emit("move", move);
                io.emit("boardState", chess.fen());

                if (chess.isCheckmate()) {
                    const winner = currentPlayer === 'w' ? playerNames[players.black] : playerNames[players.white];
                    io.emit("gameOver", { winner: winner, reason: "checkmate" });
                } else if (chess.isDraw()) {
                    io.emit("gameOver", { winner: null, reason: "draw" });
                } else if (chess.isStalemate()) {
                    io.emit("gameOver", { winner: null, reason: "stalemate" });
                } else if (chess.isThreefoldRepetition()) {
                    io.emit("gameOver", { winner: null, reason: "threefold repetition" });
                } else if (chess.isInsufficientMaterial()) {
                    io.emit("gameOver", { winner: null, reason: "insufficient material" });
                }
            } else {
                io.emit("error", "Invalid move:", move);
                uniquesocket.emit("invalidMove", move);
            }
        } catch (err) {
            console.error("Error processing move:", err);
            uniquesocket.emit("invalidMove", move);
        }
    });

    uniquesocket.on("resetGame", () => {
        chess.reset();
        io.emit("boardState", chess.fen());
    });
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;
