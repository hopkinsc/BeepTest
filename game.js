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
let audioContext;
let noiseBuffer;

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

function ensureAudio() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
    noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.35, audioContext.sampleRate);
    const samples = noiseBuffer.getChannelData(0);

    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.random() * 2 - 1;
    }
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

function playMoveSound() {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const hiss = audioContext.createBufferSource();
  hiss.buffer = noiseBuffer;

  const hissFilter = audioContext.createBiquadFilter();
  hissFilter.type = 'bandpass';
  hissFilter.frequency.value = 1900;
  hissFilter.Q.value = 0.9;

  const hissGain = audioContext.createGain();
  hissGain.gain.setValueAtTime(0.0001, now);
  hissGain.gain.exponentialRampToValueAtTime(0.018, now + 0.02);
  hissGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  hiss.connect(hissFilter);
  hissFilter.connect(hissGain);
  hissGain.connect(audioContext.destination);

  const tone = audioContext.createOscillator();
  tone.type = 'sawtooth';
  tone.frequency.setValueAtTime(160, now);
  tone.frequency.exponentialRampToValueAtTime(110, now + 0.08);

  const toneGain = audioContext.createGain();
  toneGain.gain.setValueAtTime(0.0001, now);
  toneGain.gain.exponentialRampToValueAtTime(0.01, now + 0.015);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  tone.connect(toneGain);
  toneGain.connect(audioContext.destination);

  hiss.start(now);
  hiss.stop(now + 0.1);
  tone.start(now);
  tone.stop(now + 0.1);
}

function playEatSound() {
  if (!audioContext) return;

  const now = audioContext.currentTime;

  const squelch = audioContext.createOscillator();
  squelch.type = 'triangle';
  squelch.frequency.setValueAtTime(420, now);
  squelch.frequency.exponentialRampToValueAtTime(120, now + 0.16);

  const lowpass = audioContext.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 750;

  const squelchGain = audioContext.createGain();
  squelchGain.gain.setValueAtTime(0.0001, now);
  squelchGain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
  squelchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  squelch.connect(lowpass);
  lowpass.connect(squelchGain);
  squelchGain.connect(audioContext.destination);

  const splat = audioContext.createBufferSource();
  splat.buffer = noiseBuffer;

  const splatFilter = audioContext.createBiquadFilter();
  splatFilter.type = 'lowpass';
  splatFilter.frequency.value = 450;

  const splatGain = audioContext.createGain();
  splatGain.gain.setValueAtTime(0.0001, now);
  splatGain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
  splatGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

  splat.connect(splatFilter);
  splatFilter.connect(splatGain);
  splatGain.connect(audioContext.destination);

  squelch.start(now);
  squelch.stop(now + 0.22);
  splat.start(now);
  splat.stop(now + 0.18);
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

  playMoveSound();
  worm.unshift(newHead);

  if (newHead.x === food.x && newHead.y === food.y) {
    playEatSound();
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

function drawBlob(x, y, isHead) {
  const px = x * gridSize;
  const py = y * gridSize;
  const centerX = px + gridSize / 2;
  const centerY = py + gridSize / 2;

  const gradient = ctx.createRadialGradient(
    centerX - 4,
    centerY - 4,
    2,
    centerX,
    centerY,
    gridSize * 0.52,
  );
  gradient.addColorStop(0, isHead ? '#91ff95' : '#73eb79');
  gradient.addColorStop(1, isHead ? '#2f9f44' : '#22883a');

  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.arc(centerX - 3, centerY - 2, gridSize * 0.34, 0, Math.PI * 2);
  ctx.arc(centerX + 4, centerY + 1, gridSize * 0.3, 0, Math.PI * 2);
  ctx.arc(centerX, centerY + 4, gridSize * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(x, y) {
  const px = x * gridSize + gridSize / 2;
  const py = y * gridSize + gridSize / 2;
  const outerRadius = gridSize * 0.42;
  const innerRadius = gridSize * 0.18;

  ctx.beginPath();

  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const sx = px + Math.cos(angle) * radius;
    const sy = py + Math.sin(angle) * radius;

    if (i === 0) {
      ctx.moveTo(sx, sy);
    } else {
      ctx.lineTo(sx, sy);
    }
  }

  ctx.closePath();

  const gradient = ctx.createRadialGradient(px - 2, py - 3, 2, px, py, outerRadius);
  gradient.addColorStop(0, '#fff8b8');
  gradient.addColorStop(0.6, '#ffd84d');
  gradient.addColorStop(1, '#f5b301');

  ctx.fillStyle = gradient;
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

  drawStar(food.x, food.y);

  worm.forEach((segment, index) => {
    drawBlob(segment.x, segment.y, index === 0);
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
    ensureAudio();
    event.preventDefault();
  }

  if (key === 'arrowup' || key === 'w') setDirection({ x: 0, y: -1 });
  if (key === 'arrowdown' || key === 's') setDirection({ x: 0, y: 1 });
  if (key === 'arrowleft' || key === 'a') setDirection({ x: -1, y: 0 });
  if (key === 'arrowright' || key === 'd') setDirection({ x: 1, y: 0 });
});

restartButton.addEventListener('click', () => {
  ensureAudio();
  resetGame();
});

resetGame();

clearInterval(gameLoop);
gameLoop = setInterval(update, 120);
