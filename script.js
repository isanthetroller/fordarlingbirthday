// Spawn subtle floating ambient particles
const sparklesContainer = document.getElementById('sparkles');
const particleCount = 20;
for (let i = 0; i < particleCount; i++) {
  const sparkle = document.createElement('div');
  sparkle.className = 'sparkle';
  sparkle.style.left = `${Math.random() * 100}vw`;
  sparkle.style.top = `${60 + Math.random() * 40}vh`;
  sparkle.style.animationDelay = `${Math.random() * 6}s`;
  sparkle.style.animationDuration = `${5.5 + Math.random() * 4}s`;
  const size = 3 + Math.random() * 4;
  sparkle.style.width = `${size}px`;
  sparkle.style.height = `${size}px`;
  sparklesContainer.appendChild(sparkle);
}

// Preload the 5 cut-out flower images
const flowerSrcs = [
  'flower1.png',
  'flower2.png',
  'flower3.png',
  'flower4.png',
  'flower5.png'
];
const flowerImages = flowerSrcs.map(src => {
  const img = new Image();
  img.src = src;
  return img;
});

// Canvas Setup
const canvas = document.getElementById('burstCanvas');
const ctx = canvas.getContext('2d');
let width, height, centerX, centerY, maxRadius;
let burstParticles = [];
let isBursting = false;
let lastFrameTime = 0;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  centerX = width / 2;
  centerY = height / 2;
  maxRadius = Math.hypot(width, height) / 2 + 180;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Golden angle for organic 360-degree radial dispersion
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 rad

// 360-Degree Unified Radial Flower Particle
// Radiates outward evenly with a gentle, graceful spin, filling the screen fast
class ContinuousDisperseFlower {
  constructor(angle, layer = 1, initialRadius = 0, imgIndex = 0) {
    this.img = flowerImages[imgIndex % flowerImages.length];
    this.layer = layer; // 0 = Background, 1 = Midground, 2 = Foreground
    this.angle = angle; // Fixed radial direction
    this.radius = initialRadius; // Starts at center or staggered ring

    // Accelerated outward speeds (3.2 - 5.2 px/frame) so the entire screen fills in ~4-5 seconds
    if (this.layer === 0) {
      this.targetSize = 220; // Softer background layer
      this.speed = 3.2;
      this.maxOpacity = 0.88;
    } else if (this.layer === 1) {
      this.targetSize = 280; // Vibrant midground layer
      this.speed = 4.2;
      this.maxOpacity = 0.94;
    } else {
      this.targetSize = 340; // Majestic foreground blossoms
      this.speed = 5.2;
      this.maxOpacity = 0.99;
    }

    // Gentle, natural spin/rotation while dispersing outward
    this.spinSpeed = (imgIndex % 2 === 0 ? 1 : -1) * 0.009;
    this.rotation = Math.random() * Math.PI * 2;

    this.size = initialRadius > 0 ? this.targetSize : 18;
    this.opacity = initialRadius > 0 ? this.maxOpacity : 0;
    this.dead = false;

    // Drop-down animation state
    this.isDropping = false;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.gravity = 0;
    this.dropDelay = 0;
    this.driftSpeed = 0;
  }

  update(dt) {
    const timeScale = dt * 60; // 60fps normalized

    // Drop-down mode: gravity accelerates flowers downward off the screen
    if (this.isDropping) {
      if (this.dropDelay > 0) {
        this.dropDelay -= dt;
        return;
      }
      this.vy += this.gravity * timeScale;
      this.y += this.vy * timeScale;
      this.x += this.driftSpeed * timeScale;
      this.rotation += this.spinSpeed * 1.6 * timeScale;

      if (this.y > height + 250) {
        this.dead = true;
      }
      return;
    }

    // 1. Uniform fast outward dispersion in 360 degrees
    this.radius += this.speed * timeScale;

    // 2. Gentle graceful spin/rotation
    this.rotation += this.spinSpeed * timeScale;

    // 3. Fast blossoming growth from center bud into full blossom
    if (this.size < this.targetSize) {
      const growthProgress = Math.min(1.0, this.radius / 120);
      const easeOutGrowth = 1 - Math.pow(1 - growthProgress, 3);
      this.size = Math.max(18, this.targetSize * easeOutGrowth);
    }

    // 4. Quick fade-in near center, then STAY FULLY VISIBLE across the screen
    if (this.radius < 75) {
      this.opacity = Math.min(this.maxOpacity, (this.radius / 65) * this.maxOpacity);
    } else {
      this.opacity = this.maxOpacity;
    }

    // 5. Prune only once far beyond the screen corners
    if (this.radius > maxRadius + 180) {
      this.dead = true;
    }
  }

  draw() {
    if (this.opacity <= 0.01) return;

    let x, y;
    if (this.isDropping) {
      x = this.x;
      y = this.y;
    } else {
      x = centerX + Math.cos(this.angle) * this.radius;
      y = centerY + Math.sin(this.angle) * this.radius;
    }

    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(x, y);
    ctx.rotate(this.rotation);
    if (this.img.complete && this.img.naturalWidth > 0) {
      ctx.drawImage(this.img, -this.size / 2, -this.size / 2, this.size, this.size);
    }
    ctx.restore();
  }
}

let isDroppingDown = false;

function triggerFlowersDropDown() {
  if (isDroppingDown) return;
  isDroppingDown = true;

  // Stop always.mp3 exactly as the webp animation stops!
  stopIntroAlwaysAudio();

  // 1. Drop down the central blooming flower WebP off the bottom
  flowerContainer.classList.add('drop-down');

  // 2. Cascade drop for all flowers on canvas from top to bottom
  for (let i = 0; i < burstParticles.length; i++) {
    const p = burstParticles[i];
    p.isDropping = true;
    p.x = centerX + Math.cos(p.angle) * p.radius;
    p.y = centerY + Math.sin(p.angle) * p.radius;

    // Top-to-bottom cascade delay:
    // Flowers higher up (smaller y) drop first, cascading downward
    const normY = Math.max(0, Math.min(1, (p.y + 100) / (height + 200)));
    p.dropDelay = normY * 0.35; // 0ms to 350ms top-to-bottom waterfall stagger
    p.vy = 2.5 + Math.random() * 2.0; // Initial downward drop speed
    p.gravity = 0.65 + Math.random() * 0.15; // Natural gravity acceleration
    p.driftSpeed = (Math.random() - 0.5) * 1.5; // Subtle air flutter
  }

  // 3. Remove flower canvas and reveal the retro mixtape card in the center
  setTimeout(() => {
    isBursting = false;
    burstParticles = [];
    ctx.clearRect(0, 0, width, height);
    canvas.style.display = 'none';
    flowerContainer.style.display = 'none';

    // Reveal the retro "Songs for you" mixtape card in the center!
    const mixtapeCard = document.getElementById('mixtapeCard');
    if (mixtapeCard) {
      mixtapeCard.classList.add('visible');
      // Automatically play "Happy Birthday to You" while cassette is playing!
      startHappyBirthdaySong();
    }
  }, 1200);
}

function startContinuousSwirlingBurst() {
  if (isBursting) return;
  isBursting = true;
  lastFrameTime = performance.now();

  const NUM_ARMS = 12; // 12 evenly spaced compass rays (30° apart)
  let pulseCount = 0;
  let spawnTimer = 0;
  const PULSE_INTERVAL = 0.12; // Emit balanced wave every 120ms for rapid, dense filling

  // Initial balanced seed: 3 concentric rings (0px, 150px, 300px) so the screen starts filling immediately
  for (let r = 0; r < 3; r++) {
    const ringRadius = r * 150;
    const ringOffset = (r % 2) * (Math.PI / NUM_ARMS); // Interleaved ray angles
    for (let i = 0; i < NUM_ARMS; i++) {
      const angle = (i / NUM_ARMS) * Math.PI * 2 + ringOffset;
      const layer = (r + i) % 3;
      const imgIdx = (r * NUM_ARMS + i) % flowerImages.length;
      burstParticles.push(new ContinuousDisperseFlower(angle, layer, ringRadius, imgIdx));
    }
  }

  // Endless animation loop until drop-down cleans up
  function animateContinuous(currentTime) {
    const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.04);
    lastFrameTime = currentTime;

    // CONTINUOUS EVEN 360-DEGREE DISPERSION (stops when drop-down triggers)
    if (!isDroppingDown) {
      spawnTimer += dt;
      while (spawnTimer >= PULSE_INTERVAL) {
        spawnTimer -= PULSE_INTERVAL;
        pulseCount++;
        const angleOffset = (pulseCount % 2) * (Math.PI / NUM_ARMS); // Interleave 15° between pulses

        for (let i = 0; i < NUM_ARMS; i++) {
          const angle = (i / NUM_ARMS) * Math.PI * 2 + angleOffset;
          const layer = (pulseCount + i) % 3;
          const imgIdx = (pulseCount + i) % flowerImages.length;
          burstParticles.push(new ContinuousDisperseFlower(angle, layer, 0, imgIdx));
        }
      }
    }

    ctx.clearRect(0, 0, width, height);

    // Update and prune off-screen particles
    const alive = [];
    for (let i = 0; i < burstParticles.length; i++) {
      const p = burstParticles[i];
      p.update(dt);
      if (!p.dead) {
        alive.push(p);
      }
    }
    burstParticles = alive;

    // Sort by layer so Foreground paints above Midground and Background
    burstParticles.sort((a, b) => a.layer - b.layer);

    // Draw all dispersing flowers
    for (let i = 0; i < burstParticles.length; i++) {
      burstParticles[i].draw();
    }

    if (isBursting) {
      requestAnimationFrame(animateContinuous);
    }
  }

  requestAnimationFrame(animateContinuous);
}

// Interactive Click Flow & Romantic Intro Audio (Daniel Caesar - Always)
const envelopeWrapper = document.getElementById('envelopeWrapper');
const envelopeCard = document.getElementById('envelopeCard');
const clickMeHint = document.getElementById('clickMeHint');
const flowerContainer = document.getElementById('flowerContainer');
const flowerImg = document.getElementById('flowerImg');

let isOpened = false;
let introAudio = null;

function playIntroAlwaysAudio() {
  try {
    if (!introAudio) {
      introAudio = new Audio('always.mp3');
    }
    introAudio.loop = true; // Keep playing on loop from envelope through webp
    introAudio.volume = 0.68; // Lower volume as requested (at least 80% max volume)
    introAudio.play().catch(() => {
      // Fallback to URL-encoded filename if needed
      introAudio.src = 'Daniel%20Caesar%20-%20Always%20(Lyrics)%20(mp3cut.net)%20(2).mp3';
      introAudio.loop = true;
      introAudio.volume = 0.68;
      introAudio.play().catch(e => console.log('Audio playback note:', e));
    });
  } catch (err) {
    console.log('Audio init error:', err);
  }
}

function stopIntroAlwaysAudio() {
  if (introAudio) {
    introAudio.pause();
    introAudio.currentTime = 0;
  }
}

// Attempt immediate playback at start of website
window.addEventListener('DOMContentLoaded', () => {
  try {
    introAudio = new Audio('always.mp3');
    introAudio.loop = true;
    introAudio.volume = 0.68;
    introAudio.play().catch(() => {
      // Browsers require user interaction; click-me badge / envelope click will trigger play
    });
  } catch (e) {}
});

function openEnvelopeExperience() {
  if (isOpened) return;
  isOpened = true;

  // Unlock Web Audio context during initial user click gesture
  initAudioContext();

  // Play Daniel Caesar - Always while transition is running before Happy Birthday song starts
  playIntroAlwaysAudio();

  // 1. Smooth opening transition: closed envelope seamlessly yields as open letter blossoms upward
  envelopeCard.classList.add('opened');

  // 2. Hold open for 1.5 seconds to read letter & admire florals
  setTimeout(() => {
    // Dreamy fade-out
    envelopeCard.classList.add('fade-out');

    // 3. When fade transition finishes, hide envelope wrapper and reveal transparent blooming flower
    setTimeout(() => {
      envelopeWrapper.style.display = 'none';

      // Reveal transparent blooming flower video
      flowerImg.src = 'letter_flower.webp?t=' + Date.now();
      flowerContainer.classList.add('visible');

      // Trigger continuous flower dispersion in the background
      startContinuousSwirlingBurst();

      // 4. Change background in advance to the sunlit meadow image 1 second before WebP finishes (at 9.0s)
      setTimeout(() => {
        const meadowBg = document.getElementById('meadowBg');
        if (meadowBg) {
          meadowBg.classList.add('visible');
        }
      }, 9000); // 9.0 seconds = 1s in advance before 10.0s WebP finish

      // 5. When the WebP animation finishes (at 10.0s), drop all flowers from top to bottom
      setTimeout(() => {
        triggerFlowersDropDown();
      }, 10000); // Exactly 10.0 seconds
    }, 900); // 900ms matches the smooth CSS fade-out duration
  }, 1500); // Exactly 1.5 seconds
}

envelopeCard.addEventListener('click', openEnvelopeExperience);
if (clickMeHint) {
  clickMeHint.addEventListener('click', openEnvelopeExperience);
}

// ========================================================
// RETRO CASSETTE & HAPPY BIRTHDAY AUDIO SYNTHESIZER
// ========================================================
let audioCtx = null;
let isMusicPlaying = false;
let melodyTimer = null;
let noteIndex = 0;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Warm, romantic acoustic music box & piano tone generator
function playAcousticTone(freq, duration = 0.5, volume = 0.16, isMelody = true) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;

  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const osc3 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // Fundamental: warm triangle wave
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(freq, now);

  // First overtone: gentle pure sine wave
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, now);

  // Subtle acoustic chime sparkle for melody notes
  if (isMelody) {
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, now);
    const chimeGain = audioCtx.createGain();
    chimeGain.gain.setValueAtTime(volume * 0.25, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc3.connect(chimeGain);
    chimeGain.connect(gain);
    osc3.start(now);
    osc3.stop(now + 0.2);
  }

  // Natural acoustic envelope: soft attack, sustained resonance, gradual decay
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.85);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration + 0.9);
  osc2.stop(now + duration + 0.9);
}

// Musical score for "Happy Birthday to You" in F Major (Melody + Harmony Chords)
const happyBirthdaySong = [
  // Phrase 1: Happy birthday to you
  { melody: 261.63, chords: [], d: 0.32, gap: 0.32 }, // Hap-
  { melody: 261.63, chords: [], d: 0.32, gap: 0.32 }, // -py
  { melody: 293.66, chords: [174.61, 220.00], d: 0.58, gap: 0.62 }, // birth-
  { melody: 261.63, chords: [174.61], d: 0.58, gap: 0.62 }, // -day
  { melody: 349.23, chords: [220.00], d: 0.58, gap: 0.62 }, // to
  { melody: 329.63, chords: [130.81, 196.00, 261.63], d: 1.15, gap: 1.25 }, // you

  // Phrase 2: Happy birthday to you
  { melody: 261.63, chords: [], d: 0.32, gap: 0.32 }, // Hap-
  { melody: 261.63, chords: [], d: 0.32, gap: 0.32 }, // -py
  { melody: 293.66, chords: [130.81, 196.00], d: 0.58, gap: 0.62 }, // birth-
  { melody: 261.63, chords: [196.00], d: 0.58, gap: 0.62 }, // -day
  { melody: 392.00, chords: [130.81, 261.63], d: 0.58, gap: 0.62 }, // to
  { melody: 349.23, chords: [174.61, 220.00, 261.63], d: 1.15, gap: 1.25 }, // you

  // Phrase 3: Happy birthday dear darling
  { melody: 261.63, chords: [], d: 0.32, gap: 0.32 }, // Hap-
  { melody: 261.63, chords: [], d: 0.32, gap: 0.32 }, // -py
  { melody: 523.25, chords: [174.61, 261.63, 349.23], d: 0.58, gap: 0.62 }, // birth-
  { melody: 440.00, chords: [174.61, 349.23], d: 0.58, gap: 0.62 }, // -day
  { melody: 349.23, chords: [146.83, 220.00], d: 0.58, gap: 0.62 }, // dear
  { melody: 329.63, chords: [146.83], d: 0.52, gap: 0.56 }, // dar-
  { melody: 293.66, chords: [116.54, 233.08, 349.23], d: 1.10, gap: 1.20 }, // -ling

  // Phrase 4: Happy birthday to you
  { melody: 466.16, chords: [116.54], d: 0.32, gap: 0.32 }, // Hap-
  { melody: 466.16, chords: [233.08], d: 0.32, gap: 0.32 }, // -py
  { melody: 440.00, chords: [174.61, 261.63], d: 0.58, gap: 0.62 }, // birth-
  { melody: 349.23, chords: [174.61], d: 0.58, gap: 0.62 }, // -day
  { melody: 392.00, chords: [130.81, 196.00, 261.63], d: 0.58, gap: 0.62 }, // to
  { melody: 349.23, chords: [87.31, 174.61, 261.63, 440.00], d: 1.70, gap: 2.30 }  // you (grand finale chord & tender pause)
];

// Pre-compute note timestamps and total song duration
let totalSongDuration = 0;
const noteTimestamps = [];
happyBirthdaySong.forEach(note => {
  noteTimestamps.push(totalSongDuration);
  totalSongDuration += note.gap;
});

let currentNoteStartTime = 0;
let currentNoteBaseTime = 0;
let progressAnimFrame = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateProgressBar() {
  const progressBarFill = document.getElementById('progressBarFill');
  const playerTime = document.getElementById('playerTime');

  if (!isMusicPlaying) return;

  const now = performance.now();
  const elapsedInNote = (now - currentNoteStartTime) / 1000;
  const currentSongTime = Math.min(totalSongDuration, currentNoteBaseTime + elapsedInNote);

  const pct = Math.min(100, Math.max(0, (currentSongTime / totalSongDuration) * 100));
  if (progressBarFill) {
    progressBarFill.style.width = `${pct}%`;
  }
  if (playerTime) {
    playerTime.textContent = `${formatTime(currentSongTime)} / ${formatTime(totalSongDuration)}`;
  }

  progressAnimFrame = requestAnimationFrame(updateProgressBar);
}

function playNextNote() {
  if (!isMusicPlaying) return;
  const currentNote = happyBirthdaySong[noteIndex];

  // Record playback timeline for progress bar
  currentNoteBaseTime = noteTimestamps[noteIndex];
  currentNoteStartTime = performance.now();

  // Play main melody note
  playAcousticTone(currentNote.melody, currentNote.d, 0.18, true);

  // Play accompaniment chord harmonies
  if (currentNote.chords && currentNote.chords.length > 0) {
    const chordVol = 0.08 / currentNote.chords.length;
    currentNote.chords.forEach(chordFreq => {
      playAcousticTone(chordFreq, currentNote.d + 0.3, chordVol, false);
    });
  }

  noteIndex = (noteIndex + 1) % happyBirthdaySong.length;
  melodyTimer = setTimeout(playNextNote, currentNote.gap * 1000);
}

function startHappyBirthdaySong() {
  initAudioContext();
  isMusicPlaying = true;
  clearTimeout(melodyTimer);
  cancelAnimationFrame(progressAnimFrame);
  updateAudioUI();
  playNextNote();
  updateProgressBar();
}

function pauseHappyBirthdaySong() {
  isMusicPlaying = false;
  clearTimeout(melodyTimer);
  cancelAnimationFrame(progressAnimFrame);
  updateAudioUI();
}

function toggleHappyBirthdaySong() {
  if (isMusicPlaying) {
    pauseHappyBirthdaySong();
  } else {
    startHappyBirthdaySong();
  }
}

function updateAudioUI() {
  const cassetteDisplay = document.getElementById('cassetteDisplay');
  const equalizer = document.getElementById('equalizer');
  const masterPlayBtn = document.getElementById('masterPlayBtn');
  const nowPlayingTitle = document.getElementById('nowPlayingTitle');

  if (cassetteDisplay) {
    cassetteDisplay.classList.toggle('playing', isMusicPlaying);
  }
  if (equalizer) {
    equalizer.classList.toggle('active', isMusicPlaying);
  }
  if (masterPlayBtn) {
    masterPlayBtn.classList.toggle('paused', !isMusicPlaying);
    masterPlayBtn.setAttribute('title', isMusicPlaying ? 'Pause Happy Birthday' : 'Play Happy Birthday');
  }
  if (nowPlayingTitle) {
    nowPlayingTitle.textContent = isMusicPlaying ? 'Happy Birthday to You \u266B' : 'Happy Birthday to You (Paused)';
  }
}

// Master Controls & Cassette Click Listeners
const masterPlayBtn = document.getElementById('masterPlayBtn');
const cassetteDisplay = document.getElementById('cassetteDisplay');
const progressBarTrack = document.getElementById('progressBarTrack');

if (masterPlayBtn) {
  masterPlayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleHappyBirthdaySong();
  });
}

if (cassetteDisplay) {
  cassetteDisplay.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleHappyBirthdaySong();
  });
}

// Interactive progress bar seek
if (progressBarTrack) {
  progressBarTrack.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = progressBarTrack.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = clickRatio * totalSongDuration;

    // Find the note closest to this timestamp
    let closestIndex = 0;
    for (let i = 0; i < noteTimestamps.length; i++) {
      if (noteTimestamps[i] <= targetTime) {
        closestIndex = i;
      }
    }

    noteIndex = closestIndex;
    if (isMusicPlaying) {
      clearTimeout(melodyTimer);
      cancelAnimationFrame(progressAnimFrame);
      playNextNote();
      updateProgressBar();
    } else {
      currentNoteBaseTime = noteTimestamps[noteIndex];
      const progressBarFill = document.getElementById('progressBarFill');
      const playerTime = document.getElementById('playerTime');
      if (progressBarFill) {
        progressBarFill.style.width = `${clickRatio * 100}%`;
      }
      if (playerTime) {
        playerTime.textContent = `${formatTime(targetTime)} / ${formatTime(totalSongDuration)}`;
      }
    }
  });
}


