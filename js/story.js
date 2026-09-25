/**
 * story.js — StoryManager
 *
 * Manages scroll-based section transitions.
 * Tells the CharacterController what to do for each section.
 */

class StoryManager {
  constructor(character) {
    this.char = character;

    this.SECTIONS = [
      'sec-intro',
      'sec-bday',
      'sec-why',
      'sec-letter',
      'sec-song',
      'sec-memories',
      'sec-surprise',
      'sec-final'
    ];

    this.currentIndex = -1;
    this.isStarted = false;
    this.sectionObserver = null;
    this.revealObserver = null;

    // Timers for sequencing
    this._timers = [];
  }

  init() {
    this._setupSectionObserver();
    this._setupRevealObserver();

    const dialog = document.getElementById('letter-dialog');
    if (dialog) {
      dialog.addEventListener('close', (event) => {
        if (event.currentTarget.returnValue !== 'replay') this._finishLetter();
      });
    }
  }

  /* ─── SECTION OBSERVER ─── */

  _setupSectionObserver() {
    this.sectionObserver = new IntersectionObserver((entries) => {
      let best = null;
      let bestRatio = 0;
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          best = e;
        }
      });
      if (best && best.intersectionRatio > 0.1) {
        const idx = this.SECTIONS.indexOf(best.target.id);
        if (idx !== -1 && idx !== this.currentIndex) {
          this._activateSection(idx);
        }
      }
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });

    requestAnimationFrame(() => {
      this.SECTIONS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) this.sectionObserver.observe(el);
      });
    });
  }

  /* ─── REVEAL OBSERVER ─── */

  _setupRevealObserver() {
    this.revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('show');
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -10px 0px' });

    document.querySelectorAll('.reveal, .bubble').forEach((el) => {
      this.revealObserver.observe(el);
    });
  }

  /* ─── SECTION ACTIVATION ─── */

  _activateSection(index) {
    this.currentIndex = index;
    this._updateDots(index);

    const id = this.SECTIONS[index];
    const section = document.getElementById(id);
    if (!section) return;

    section.classList.add('active-section');

    switch (id) {
      case 'sec-intro':
        this._sectionIntro();
        break;
      case 'sec-bday':
        this._sectionBirthday();
        break;
      case 'sec-why':
        this._sectionWhy();
        break;
      case 'sec-letter':
        this._sectionLetter();
        break;
      case 'sec-song':
        this._sectionSong();
        break;
      case 'sec-memories':
        this._sectionMemories();
        break;
      case 'sec-surprise':
        this._sectionSurprise();
        break;
      case 'sec-final':
        this._sectionFinal();
        break;
    }
  }

  /* ─── INDIVIDUAL SECTIONS ─── */

  _sectionIntro() {
    this.char.setAnchor('cs-intro');
    this.char.cancelMovement().stopSway().setMood('neutral');
    this.char.setPosition(0, 0, 0).faceFront();
    this.char.setAtmosphere('night');
    this.char.play('idle');
  }

  _sectionBirthday() {
    this.char.setAnchor('cs-bday');
    this.char.setMood('neutral');
    this.char.setAtmosphere('warm');
    this.char.enterFrom('left');
  }

  _sectionWhy() {
    this.char.setAnchor('cs-why');
    this.char.cancelMovement().stopSway().setMood('shy');
    this.char.setPosition(0, 0, 0).faceFront();
    this.char.setAtmosphere('cozy');
    this.char.play('idle');
  }

  _sectionLetter() {
    this.char.setAnchor(['cs-letter', 'cs-letter2']);
    this.char.cancelMovement().stopSway().setMood('thoughtful');
    this.char.setPosition(0, 0, 0).faceFront();
    this.char.setAtmosphere('cozy');
    this.char.play('idle');
  }

  _sectionSong() {
    this.char.setAnchor('cs-song');
    this.char.cancelMovement().setMood('neutral');
    this.char.setPosition(0, 0, 0).faceFront();
    this.char.setAtmosphere('moonlit');
    this.char.play('idle');
  }

  _sectionMemories() {
    this.char.setAnchor('cs-memories');
    this.char.cancelMovement().stopSway().setMood('thoughtful');
    this.char.setPosition(0, 0, 0).faceFront();
    this.char.setAtmosphere('cozy');
    this.char.play('idle');
  }

  _sectionSurprise() {
    this.char.setAnchor('cs-surprise');
    this.char.cancelMovement().stopSway().setMood('shy');
    this.char.setPosition(0, 0, 0).faceFront();
    this.char.setAtmosphere('warm');
    this.char.play('happy');
  }

  _sectionFinal() {
    this.char.setAnchor(['cs-final', 'cs-final2']);
    this.char.setMood('neutral');
    this.char.setAtmosphere('celebrate');
    this.char.enterFrom('right', {
      onArrive: () => {
        if (this.currentIndex === 7) this.char.play('celebrate', { restart: true });
      }
    });
  }

  /* ─── STORY FLOW ─── */

  startStory() {
    if (this.isStarted) return;
    this.isStarted = true;

    const intro = document.getElementById('sec-intro');
    if (!intro) return;

    intro.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    intro.style.opacity = '0';
    intro.style.transform = 'scale(0.96)';

    this._timer(() => {
      intro.style.display = 'none';

      this.SECTIONS.forEach((id, i) => {
        if (i > 0) {
          const el = document.getElementById(id);
          if (el) el.classList.remove('hidden');
        }
      });

      // Re-observe all sections now that they're visible
      this.SECTIONS.forEach((id) => {
        const el = document.getElementById(id);
        if (el && this.sectionObserver) this.sectionObserver.observe(el);
      });

      // Observe all reveal elements
      document.querySelectorAll('.reveal, .bubble').forEach((el) => {
        if (this.revealObserver) this.revealObserver.observe(el);
      });

      const dots = document.querySelector('.progress-dots');
      if (dots) dots.classList.add('visible');

      window.scrollTo(0, 0);

      this._activateSection(1);
    }, 800);
  }

  /* ─── LETTER OPEN/CLOSE ─── */

  openLetter() {
    const env = document.getElementById('env-btn');
    const dialog = document.getElementById('letter-dialog');
    if (!env || !dialog || env.dataset.opened === 'true' || dialog.open) return;

    env.dataset.opened = 'true';
    env.setAttribute('aria-expanded', 'true');
    env.style.transition = 'all 0.4s ease';
    env.style.transform = 'scale(0.85)';
    env.style.opacity = '0';

    this._timer(() => {
      env.style.display = 'none';
      const hint = document.getElementById('env-hint');
      if (hint) hint.style.display = 'none';
      dialog.showModal();
      const content = document.getElementById('lcontent');
      const close = document.getElementById('letter-close');
      if (content) content.classList.add('vis');
      if (close) close.focus();
    }, 420);
  }

  closeLetter() {
    const dialog = document.getElementById('letter-dialog');
    if (!dialog) return;
    if (dialog.open) dialog.close('done');
  }

  _finishLetter() {
    const post = document.getElementById('lpost');
    const wrap = document.getElementById('char-letter2-wrap');
    if (post) {
      post.style.display = 'flex';
      post.style.flexDirection = 'column';
    }
    if (wrap) wrap.style.display = 'block';
    document.querySelectorAll('#sec-letter .reveal, #sec-letter .bubble').forEach((el) => {
      if (this.revealObserver) this.revealObserver.observe(el);
    });
    this.char.setAnchor(['cs-letter', 'cs-letter2']);
    this.char.play('idle');
  }

  /* ─── REPLAY ─── */

  replay() {
    this._clearTimers();
    this.isStarted = false;
    this.currentIndex = -1;

    const cakeButton = document.getElementById('cake-button');
    if (cakeButton) {
      cakeButton.classList.remove('lit');
      cakeButton.setAttribute('aria-pressed', 'false');
    }
    const cakeMessage = document.getElementById('cake-message');
    if (cakeMessage) cakeMessage.textContent = "When you're ready, make a little wish.";
    const giftButton = document.getElementById('gift-button');
    if (giftButton) {
      giftButton.classList.remove('opened', 'animating');
      giftButton.setAttribute('aria-expanded', 'false');
    }
    const petalStage = document.getElementById('petal-stage');
    if (petalStage) petalStage.classList.remove('blooming');
    const surpriseMessage = document.getElementById('surprise-message');
    if (surpriseMessage) surpriseMessage.classList.remove('visible');
    document.querySelectorAll('.confetti-piece').forEach((piece) => piece.remove());

    const dialog = document.getElementById('letter-dialog');
    if (dialog && dialog.open) dialog.close('replay');
    const env = document.getElementById('env-btn');
    if (env) { env.style.cssText = ''; env.dataset.opened = ''; env.setAttribute('aria-expanded', 'false'); }
    const hint = document.getElementById('env-hint');
    if (hint) hint.style.display = '';
    const lcontent = document.getElementById('lcontent');
    if (lcontent) lcontent.classList.remove('vis');
    const lpost = document.getElementById('lpost');
    if (lpost) lpost.style.display = 'none';
    const wrap = document.getElementById('char-letter2-wrap');
    if (wrap) wrap.style.display = 'none';

    // Reset sections
    this.SECTIONS.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (i === 0) {
        el.classList.remove('hidden');
        el.style.cssText = '';
      } else {
        el.classList.add('hidden');
      }
    });

    // Reset reveals
    document.querySelectorAll('.reveal, .bubble').forEach((el) => el.classList.remove('show'));

    // Reset progress
    const pfill = document.getElementById('pfill');
    if (pfill) pfill.style.width = '0%';
    const tcur = document.getElementById('tcur');
    if (tcur) tcur.textContent = '0:00';
    const dots = document.querySelector('.progress-dots');
    if (dots) dots.classList.remove('visible');

    // Reset intro text
    ['i-txt', 'i-sub', 'i-extra', 'i-question', 'i-reveal', 'i-greeting', 'i-byline', 'i-btn'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('on');
    });

    window.scrollTo(0, 0);

    this._timer(() => { const t = document.getElementById('i-txt'); if (t) t.classList.add('on'); }, 300);
    this._timer(() => { const s = document.getElementById('i-sub'); if (s) s.classList.add('on'); }, 750);
    this._timer(() => { const x = document.getElementById('i-extra'); if (x) x.classList.add('on'); }, 1250);
    this._timer(() => { const q = document.getElementById('i-question'); if (q) q.classList.add('on'); }, 1650);
    this._timer(() => { const r = document.getElementById('i-reveal'); if (r) r.classList.add('on'); }, 2150);
    this._timer(() => { const g = document.getElementById('i-greeting'); if (g) g.classList.add('on'); }, 2700);
    this._timer(() => { const y = document.getElementById('i-byline'); if (y) y.classList.add('on'); }, 3300);
    this._timer(() => { const b = document.getElementById('i-btn'); if (b) b.classList.add('on'); }, 3900);

    // Reset character
    this.char.setAnchor('cs-intro');
    this.char.cancelMovement();
    this.char.stopSway();
    this.char.setMood('neutral');
    this.char.setPosition(0, 0, 0);
    this.char.faceFront(true);
    this.char.play('idle');
    this.char.setAtmosphere('night');
  }

  /* ─── HELPERS ─── */

  _timer(fn, delay) {
    const id = setTimeout(fn, delay);
    this._timers.push(id);
    return id;
  }

  _clearTimers() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }

  _updateDots(activeIndex) {
    document.querySelectorAll('.progress-dots .dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === activeIndex);
    });
  }
}
