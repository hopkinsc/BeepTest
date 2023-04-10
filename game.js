let rotating = true;
let audioContext;

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  initAudioContext();

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'sine';

  if (type === 'success') {
    oscillator.frequency.value = 1000;
  } else if (type === 'fail') {
    oscillator.frequency.value = 200;
  }

  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

function rotateFace() {
  if (rotating) {
    const angle = Math.sin(rotation) * 45;
    face.style.transform = `rotate(${angle}deg)`;
    rotation += 0.01;
    setTimeout(rotateFace, 10);
  }
}

function clickNose() {
  rotating = false;
  if (Math.abs(Math.sin(rotation) * 45) <= 5) {
    playSound('success');
    alert("Success!");
  } else {
    playSound
