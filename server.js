const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/public'));

let players = {};
let obstacles = [];
let spikes = [];
let coins = [];
let gameStarted = false;
let obstacleTimer = 0;
let gameSpeed = 4;
const groundY = 350;

function spawnObjects() {
    if (!gameStarted) return;
    let rand = Math.random();
    if (rand < 0.4) {
        obstacles.push({ x: 850, y: 380, w: Math.floor(Math.random() * 50) + 45, h: 120 });
    } else if (rand < 0.7) {
        spikes.push({ x: 850, y: groundY + 30 - 25, w: 25, h: 25 });
    } else {
        coins.push({ x: 850, y: groundY - Math.floor(Math.random() * 80) - 20, r: 8, collected: false });
    }
}

setInterval(() => {
    if (!gameStarted) return;

    gameSpeed += 0.0005;
    obstacleTimer++;

    if (obstacleTimer > Math.max(60, 130 - gameSpeed * 5)) {
        spawnObjects();
        obstacleTimer = 0;
    }

    obstacles.forEach(obs => obs.x -= gameSpeed);
    spikes.forEach(spk => spk.x -= gameSpeed);
    coins.forEach(c => c.x -= gameSpeed);

    obstacles = obstacles.filter(obs => obs.x > -100);
    spikes = spikes.filter(spk => spk.x > -50);
    coins = coins.filter(c => c.x > -50 && !c.collected);

    Object.keys(players).forEach(id => {
        if (!players[id].inMenu && !players[id].isDead) {
            players[id].score += 0.1;
        }
    });

    io.emit('gameUpdate', { obstacles, spikes, coins, gameSpeed, players });
}, 1000 / 60);

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id, x: 100, y: 350, vy: 0,
        isGrounded: true, score: 0, coinsCollected: 0,
        inMenu: true, isDead: false,
        color: `hsl(${Math.random() * 360}, 100%, 60%)`
    };

    socket.emit('init', socket.id);

    socket.on('joinGame', () => {
        if (players[socket.id]) {
            players[socket.id].inMenu = false;
            players[socket.id].isDead = false;
            players[socket.id].score = 0;
            players[socket.id].coinsCollected = 0;
            players[socket.id].x = 100 + Math.random() * 80;
            players[socket.id].y = groundY;

            if (!gameStarted) {
                gameStarted = true;
                gameSpeed = 4;
                obstacles = [];
                spikes = [];
                coins = [];
            }
        }
    });

    socket.on('playerInput', (data) => {
        if (players[socket.id] && !players[socket.id].isDead && !players[socket.id].inMenu) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
        }
    });

    socket.on('coinCollected', (index) => {
        if (coins[index] && !coins[index].collected) {
            coins[index].collected = true;
            if (players[socket.id]) {
                players[socket.id].coinsCollected += 1;
                players[socket.id].score += 15;
            }
        }
    });

    socket.on('playerKilled', () => {
        if (players[socket.id]) {
            players[socket.id].isDead = true;
            let active = Object.values(players).filter(p => !p.isDead && !p.inMenu);
            if (active.length === 0) gameStarted = false;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        let active = Object.values(players).filter(p => !p.isDead && !p.inMenu);
        if (active.length === 0) gameStarted = false;
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
