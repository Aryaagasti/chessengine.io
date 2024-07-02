const socket = io();
const chess = new Chess();
const boardElement = document.querySelector("#chessboard");
const statusElement = document.querySelector("#status");
const winnerCard = document.querySelector("#winnerCard");
const winnerText = document.querySelector("#winnerText");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let playerName = null;

// Function to render the chessboard
const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";

    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square", (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark");
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareIndex;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === 'w' ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: squareIndex };
                        e.dataTransfer.setData("text/plain", "");
                        showPossibleMoves(sourceSquare);
                    }
                });

                pieceElement.addEventListener("dragend", (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                    clearPossibleMoves();
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = { row: parseInt(squareElement.dataset.row), col: parseInt(squareElement.dataset.col) };
                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    if (playerRole === 'b') {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }
};

// Function to show possible moves
const showPossibleMoves = (sourceSquare) => {
    const moves = chess.moves({ square: chess.SQUARES[sourceSquare.row * 8 + sourceSquare.col], verbose: true });
    moves.forEach((move) => {
        const row = 7 - move.to.charCodeAt(1) + 49; // Convert rank to row
        const col = move.to.charCodeAt(0) - 97; // Convert file to column
        const targetSquare = boardElement.querySelector(`[data-row='${row}'][data-col='${col}']`);
        if (targetSquare) {
            const dot = document.createElement("div");
            dot.classList.add("dot");
            targetSquare.appendChild(dot);
        }
    });
};

// Function to clear possible moves
const clearPossibleMoves = () => {
    const dots = boardElement.querySelectorAll(".dot");
    dots.forEach(dot => dot.remove());
};

// Function to handle moves
const handleMove = (sourceSquare, targetSquare) => {
    const move = {
        from: chess.SQUARES[sourceSquare.row * 8 + sourceSquare.col],
        to: chess.SQUARES[targetSquare.row * 8 + targetSquare.col]
    };

    if (chess.move(move)) {
        chess.undo();
        socket.emit("move", move);
    } else {
        console.error("Invalid move");
    }
};

// Function to reset the game
const resetGame = () => {
    winnerCard.classList.add("hidden");
    socket.emit("resetGame");
};

// Function to get Unicode for chess pieces
const getPieceUnicode = (piece) => {
    const unicodeMap = {
        'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
        'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
    };

    return unicodeMap[piece.type] || "";
};

// Event listeners for socket events
socket.on("playerRole", (data) => {
    playerRole = data.role;
    playerName = data.player;
    statusElement.innerText = `${playerName} connected. Waiting for opponent...`;
});

socket.on("status", (status) => {
    if (status.player1 && status.player2) {
        statusElement.innerText = "Both players connected. Game starts!";
        boardElement.classList.remove("hidden"); // Show the chessboard
        renderBoard();
    } else {
        statusElement.innerText = "Waiting for players to connect...";
        boardElement.classList.add("hidden"); // Hide the chessboard
    }
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
});

socket.on("boardState", (fen) => {
    chess.load(fen);
    renderBoard();
});

socket.on("invalidMove", (move) => {
    console.error("Invalid move:", move);
});

socket.on("gameOver", (data) => {
    if (data.winner) {
        winnerText.innerText = `${data.winner} wins by checkmate!`;
    } else {
        winnerText.innerText = "It's a draw!";
    }
    winnerCard.classList.remove("hidden");
    boardElement.classList.add("hidden");
});

// Emit 'joinGame' event when the page loads
socket.emit("joinGame");

// Initially hide the chessboard
boardElement.classList.add("hidden");
renderBoard();
