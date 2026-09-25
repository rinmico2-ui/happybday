/* ═══════════════════════════════════════
   MAIN.JS
   Entry Point + Loading Screen + Particles + Init
   ═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   CONFIGURATION — Edit these values
   ═══════════════════════════════════════ */
const HER_NAME = "Fhey";
const YOUR_NAME = "Mawxell";
const MODEL_PATH = "assets/models/rigged-model.glb";
const SONG_PATH = "assets/audio/hindi-sinasadya.mp3";

/* ═══════════════════════════════════════
   NAME INJECTION
   ═══════════════════════════════════════ */
function injectNames() {
  document.querySelectorAll('[data-name]').forEach((el) => {
    el.textContent = HER_NAME;
  });
  document.querySelectorAll('[data-yname]').forEach((el) {
    el.textContent = YOUR_NAME;
  });
}

/* ═══════════════════════════════════════
   PARTICLES (canvas overlay)
   ═══════════════════════════════════════ */
const Particles = (() => {
  let cvs, ctx;
  let particles = [];
  let animFrame = null;
  const COUNT = 28;

  class Particle {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.reset();
    }

    reset() {
      this.x = Math.random() * this.w;
      this.y = Math.random() * this.h;
      this.size = 1 + Math.random() * 2;
      this.vx = (Math.random() - 0.5) * 0.25;
      this.vy = -0.15 - Math.random() * 0.25;
      this.opacity = 0.08 + Math.random() * 0.35;
      this.type = Math.random() > 0.72 ? 'heart' : 'star';
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.015;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.rotSpeed;

      if (this.y < -10 || this.x < -10 || this.x > this.w + 10) {
        this.reset();
        this.y = this.h + 10;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = this.opacity;

      if (this.type === 'heart') {
        ctx.fillStyle = '#F8C8D8';
        ctx.beginPath();
        const s = this.size * 1.4;
        ctx.moveTo(0, s * 0.3);
        ctx.bezierCurveTo(-s, -s * 0.3, -s, s * 0.6, 0, s);
        ctx.bezierCurveTo(s, s * 0.6, s, -s * 0.3, 0, s * 0.3);
        ctx.fill();
      } else {
        ctx.fillStyle = '#FFE8A0';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = i * (Math.PI * 2) / 5 - Math.PI / 2;
          const r = this.size;
          if (i === 0) {
            ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          } else {
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function init() {
    cvs = document.getElementById('particles-canvas');
    if (!cvs) return;
    ctx = cvs.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < COUNT; i++) {
      particles.push(new Particle(cvs.width, cvs.height));
    }

    animate();
  }

  function resize() {
    if (!cvs) return;
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
  }

  function animate() {
    if (!ctx || !cvs) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    particles.forEach((p) => {
      p.update();
      p.draw(ctx);
    });

    animFrame = requestAnimationFrame(animate);
  }

  function destroy() {
    if (animFrame) cancelAnimationFrame(animFrame);
  }

  return { init, destroy };
})();

/* ═══════════════════════════════════════
   LOADING SCREEN
   ═══════════════════════════════════════ */
const LoadingScreen = (() => {
  let screen, barFill, readyText, readyBtn;
  let progress = 0;

  function init() {
    screen = document.getElementById('loading-screen');
    barFill = document.getElementById('loading-bar-fill');
    readyText = document.getElementById('loading-ready-text');
    readyBtn = document.getElementById('loading-ready-btn');
  }

  function setProgress(value) {
    progress = Math.min(value, 1);
    if (barFill) {
      barFill.style.width = (progress * 100) + '%';
    }
  }

  function showReady() {
    if (barFill) barFill.parentElement.style.display = 'none';

    if (readyText) {
      readyText.style.display = 'block';
      readyText.style.opacity = '0';
      readyText.style.animation = 'loadFadeIn 0.6s ease forwards';
    }

    if (readyBtn) {
      readyBtn.style.display = 'inline-block';
      readyBtn.style.opacity = '0';
      readyBtn.style.animation = 'loadFadeIn 0.6s ease 0.3s forwards';
    }
  }

  function hide() {
    if (screen) {
      screen.classList.add('fade-out');
      setTimeout(() => {
        screen.style.display = 'none';
      }, 800);
    }
  }

  return { init, setProgress, showReady, hide };
})();

/* ═══════════════════════════════════════
   PROGRESS BAR (scroll)
   ═══════════════════════════════════════ */
function updateScrollProgress() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  bar.style.width = progress + '%';
}

/* ═══════════════════════════════════════
   INTRO SEQUENCE
   ═══════════════════════════════════════ */
function playIntroSequence() {
  const txt = document.getElementById('i-txt');
  const sub = document.getElementById('i-sub');
  const btn = document.getElementById('i-btn');

  setTimeout(() => { if (txt) txt.classList.add('on'); }, 800);
  setTimeout(() => { if (sub) sub.classList.add('on'); }, 1600);
  setTimeout(() => { if (btn) btn.classList.add('on'); }, 2400);

  if (Character.getIsReady()) {
    Character.playAnimation('Idle', 0.5);
    Character.setNightAtmosphere();
  }
}

/* ═══════════════════════════════════════
   GLOBAL FUNCTIONS (called from HTML)
   ═══════════════════════════════════════ */
function startStory() {
  Story.startStory();

  if (Character.getIsReady()) {
    Character.playAnimation('Walk', 0.4);
    setTimeout(() => {
      Character.playAnimation('Wave', 0.3);
      setTimeout(() => {
        Character.playAnimation('Idle', 0.5);
      }, 2500);
    }, 1500);
  }
}

function openLetter() {
  Story.openLetter();

  if (Character.getIsReady()) {
    Character.playAnimation('Idle', 0.4);
  }
}

function togglePlay() {
  Audio.togglePlay();
}

function seek(event) {
  Audio.seek(event);
}

function replay() {
  Story.replay();
}

/* ═══════════════════════════════════════
   RENDER LOOP
   ═══════════════════════════════════════ */
function renderLoop() {
  Character.update();
  requestAnimationFrame(renderLoop);
}

/* ═══════════════════════════════════════
   BOOT
   ═══════════════════════════════════════ */
async function boot() {
  injectNames();
  LoadingScreen.init();
  Particles.init();

  const canvas = document.getElementById('three-canvas');
  Character.init(canvas);

  window.addEventListener('scroll', updateScrollProgress);

  try {
    LoadingScreen.setProgress(0.1);

    await Character.loadModel(MODEL_PATH, (progress) => {
      LoadingScreen.setProgress(0.1 + progress * 0.7);
    });

    LoadingScreen.setProgress(0.9);

    Story.init();
    Audio.init();

    LoadingScreen.setProgress(1.0);

    setTimeout(() => {
      LoadingScreen.showReady();
    }, 300);

    renderLoop();

  } catch (error) {
    console.error('Failed to initialize:', error);

    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = 'Something went wrong loading the character.';
    }

    const barContainer = document.querySelector('.loading-bar-container');
    if (barContainer) barContainer.style.display = 'none';

    const subText = document.querySelector('.loading-sub');
    if (subText) {
      subText.textContent = 'Please refresh the page.';
      subText.style.opacity = '1';
      subText.style.animation = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', boot);
