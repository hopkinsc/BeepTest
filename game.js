const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreLabel = document.getElementById('score');
const bestLabel = document.getElementById('best');
const restartButton = document.getElementById('restart');

const gridSize = 24;
const tileCount = canvas.width / gridSize;

let worm;
let direction;
let queuedDirection;
let food;
let score;
let bestScore = Number(localStorage.getItem('worm-best-score')) || 0;
let gameLoop;
let isGameOver;

function resetGame() {
  worm = [{ x: 10, y: 10 }];
  direction = { x: 1, y: 0 };
  queuedDirection = { ...direction };
  food = randomFoodPosition();
  score = 0;
  isGameOver = false;
  scoreLabel.textContent = score;
  bestLabel.textContent = bestScore;
  draw();
}

function randomFoodPosition() {
  let nextFood;

  do {
    nextFood = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (worm?.some((segment) => segment.x === nextFood.x && segment.y === nextFood.y));

  return nextFood;
}

function update() {
  if (isGameOver) return;

  direction = queuedDirection;

  const newHead = {
    x: worm[0].x + direction.x,
    y: worm[0].y + direction.y,
  };

  const hitWall =
    newHead.x < 0 ||
    newHead.x >= tileCount ||
    newHead.y < 0 ||
    newHead.y >= tileCount;
  const hitTail = worm.some((segment) => segment.x === newHead.x && segment.y === newHead.y);

  if (hitWall || hitTail) {
    isGameOver = true;
    drawGameOver();
    return;
  }

  worm.unshift(newHead);

  if (newHead.x === food.x && newHead.y === food.y) {
    score += 1;
    scoreLabel.textContent = score;

    if (score > bestScore) {
      bestScore = score;
      bestLabel.textContent = bestScore;
      localStorage.setItem('worm-best-score', String(bestScore));
    }

    food = randomFoodPosition();
  } else {
    worm.pop();
  }

  draw();
}

function drawCell(x, y, color, radius = 4) {
  const px = x * gridSize;
  const py = y * gridSize;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(px + 1, py + 1, gridSize - 2, gridSize - 2, radius);
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#d7e7fc';
  ctx.lineWidth = 1;

  for (let i = 1; i < tileCount; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * gridSize, 0);
    ctx.lineTo(i * gridSize, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * gridSize);
    ctx.lineTo(canvas.width, i * gridSize);
    ctx.stroke();
  }

  drawCell(food.x, food.y, '#e24f5f', 12);

  worm.forEach((segment, index) => {
    drawCell(segment.x, segment.y, index === 0 ? '#2d63f2' : '#4f8aff');
  });
}

function drawGameOver() {
  draw();

  ctx.fillStyle = 'rgba(12, 18, 32, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = '18px Arial';
  ctx.fillText('Press Restart to try again', canvas.width / 2, canvas.height / 2 + 24);
}

function setDirection(next) {
  const opposite = direction.x + next.x === 0 && direction.y + next.y === 0;
  if (!opposite) queuedDirection = next;
}

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();

  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
    event.preventDefault();
  }

  if (key === 'arrowup' || key === 'w') setDirection({ x: 0, y: -1 });
  if (key === 'arrowdown' || key === 's') setDirection({ x: 0, y: 1 });
  if (key === 'arrowleft' || key === 'a') setDirection({ x: -1, y: 0 });
  if (key === 'arrowright' || key === 'd') setDirection({ x: 1, y: 0 });
});

restartButton.addEventListener('click', () => {
  resetGame();
});

resetGame();

clearInterval(gameLoop);
gameLoop = setInterval(update, 120);
