const stage = document.querySelector('#invitation');
const idleScreen = document.querySelector('#idle-screen');
const idleVideo = document.querySelector('#idle-video');
const opening = document.querySelector('#opening');
const openButton = document.querySelector('#open-button');
const film = document.querySelector('#film');
const filmControls = document.querySelector('#film-controls');
const sound = document.querySelector('#sound');
const skip = document.querySelector('#skip');
const finale = document.querySelector('#finale');
const eventTitle = document.querySelector('#event-title');
const replay = document.querySelector('#replay');
const badgeButton = document.querySelector('#badge-button');
const badgeRotor = document.querySelector('#badge-rotor');
const badgeMotion = document.querySelector('.badge-motion');
const revealItems = [...document.querySelectorAll('.reveal')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motion = window.anime;
const badge = { angle: 0, target: 0, shown: 0 };

let drag, timer;
let request = 0;
let transitionId = 0;
let lastFrame = 0;
let clickAfterDrag = 0;

function scene(next) {
  stage.dataset.scene = next;
  const idle = next === 'idle';
  const final = next === 'finale';
  opening.inert = !idle;
  idleScreen.inert = !idle;
  filmControls.inert = next !== 'film';
  finale.inert = !final;
  finale.setAttribute('aria-hidden', String(!final));
}

function frame(now) {
  request = 0;
  if (stage.dataset.scene === 'finale') {
    const elapsed = lastFrame ? Math.min(50, now - lastFrame) : 16;
    lastFrame = now;
    badge.shown += (badge.target - badge.shown) * (1 - Math.exp(-elapsed / 65));
    const moving = !drag && !reducedMotion.matches;
    const yaw = badge.shown + (moving ? Math.sin(now / 1250) * 12 : 0);
    const pitch = moving ? -4 + Math.cos(now / 1500) * 5 : 0;
    badgeRotor.style.transform = 'rotateX(' + pitch + 'deg) rotateY(' + yaw + 'deg)';
  }
  if (stage.dataset.scene === 'finale' &&
      (!reducedMotion.matches || Math.abs(badge.target - badge.shown) > .04)) startFrames();
}

function startFrames() {
  if (!request) request = requestAnimationFrame(frame);
}

function idle(focus = false) {
  clearTimeout(timer);
  transitionId += 1;
  if (stage.dataset.scene === 'finale') finale.scrollTop = 0;
  film.pause();
  if (film.readyState > 0) film.currentTime = 0;
  delete stage.dataset.videoVisible;
  if (idleVideo.readyState > 0) idleVideo.currentTime = 0;
  scene('idle');
  if (reducedMotion.matches) idleVideo.pause();
  else idleVideo.play().catch(() => {});
  if (reducedMotion.matches || focus) stage.dataset.prompt = '';
  else {
    delete stage.dataset.prompt;
    const id = transitionId;
    setTimeout(() => {
      if (id === transitionId) stage.dataset.prompt = '';
    }, 720);
  }
  if (focus) openButton.focus({ preventScroll: true });
}

function openInvitation() {
  if (stage.dataset.scene !== 'idle') return;
  if (reducedMotion.matches) {
    showFinale(true);
    return;
  }
  const id = ++transitionId;
  scene('film');
  skip.focus({ preventScroll: true });
  timer = setTimeout(() => showFinale(true), 9500);
  film.play().catch(() => {
    if (id === transitionId) showFinale(true);
  });
}

film.addEventListener('playing', () => {
  if (stage.dataset.scene !== 'film') return;
  stage.dataset.videoVisible = '';
  idleVideo.pause();
});
film.addEventListener('ended', () => {
  if (stage.dataset.scene === 'film') showFinale(true);
});
film.addEventListener('error', () => {
  if (stage.dataset.scene === 'film') showFinale(true);
});

function showFinale(focus) {
  if (stage.dataset.scene === 'finale') return;
  clearTimeout(timer);
  transitionId += 1;
  film.pause();
  idleVideo.pause();
  badge.angle = badge.target = badge.shown = 0;
  badgeRotor.style.transform = '';
  badgeMotion.removeAttribute('style');
  revealItems.forEach(item => item.removeAttribute('style'));
  scene('finale');
  if (reducedMotion.matches || !motion) {
    badgeMotion.style.opacity = 1;
    revealItems.forEach(item => { item.style.opacity = 1; });
  } else {
    motion.createTimeline()
      .add(badgeMotion, {
        opacity: { from: 0, to: 1, duration: 420 },
        y: { from: 55, to: 0 },
        scale: { from: .56, to: 1 },
        rotateY: { from: -78, to: 0 },
        rotateZ: { from: -15, to: 0 },
        duration: 1180, ease: 'outExpo'
      }, 0)
      .add(revealItems, {
        opacity: { from: 0, to: 1 }, y: { from: 11, to: 0 },
        duration: 670, delay: motion.stagger(85), ease: 'outCubic'
      }, 290);
  }
  if (focus) eventTitle.focus({ preventScroll: true });
  startFrames();
}

function turnBadge(angle) {
  badge.angle = badge.target = angle;
  if (reducedMotion.matches) badge.shown = angle;
  startFrames();
}

badgeButton.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  badgeButton.setPointerCapture(event.pointerId);
  drag = { x: event.clientX, angle: badge.angle, moved: false };
});
badgeButton.addEventListener('pointermove', event => {
  if (!drag || !event.isPrimary) return;
  const dx = event.clientX - drag.x;
  if (Math.abs(dx) > 6) drag.moved = true;
  if (drag.moved) turnBadge(drag.angle + dx * 1.55);
});
function releaseBadge(event) {
  if (!drag || !event.isPrimary) return;
  if (drag.moved) clickAfterDrag = performance.now() + 350;
  drag = undefined;
  startFrames();
}
badgeButton.addEventListener('pointerup', releaseBadge);
badgeButton.addEventListener('pointercancel', releaseBadge);
badgeButton.addEventListener('click', event => {
  if (event.detail && performance.now() < clickAfterDrag) return;
  turnBadge((Math.round(badge.angle / 180) + 1) * 180);
});
badgeButton.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  turnBadge(badge.angle + (event.key === 'ArrowLeft' ? -30 : 30));
});

sound.addEventListener('click', () => {
  film.muted = !film.muted;
  sound.setAttribute('aria-pressed', String(!film.muted));
  sound.setAttribute('aria-label', film.muted ? '开启声音' : '关闭声音');
});
idleScreen.addEventListener('click', openInvitation);
openButton.addEventListener('click', openInvitation);
skip.addEventListener('click', () => showFinale(true));
replay.addEventListener('click', () => idle(true));

reducedMotion.addEventListener('change', () => {
  if (stage.dataset.scene === 'idle') idle();
  else if (reducedMotion.matches && stage.dataset.scene === 'film') showFinale(true);
  startFrames();
});

idle();
