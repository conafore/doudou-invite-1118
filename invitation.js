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
const filmStart = 1.67;

let drag, timer, filmAlignment;
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

function buildMedalEdge() {
  const outline = document.querySelector('#medal-outline');
  const { width, height } = outline.ownerSVGElement.viewBox.baseVal;
  const points = outline.points;
  const wall = document.createDocumentFragment();
  for (let i = 0; i < points.numberOfItems; i++) {
    const a = points.getItem(i);
    const b = points.getItem((i + 1) % points.numberOfItems);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const angle = Math.atan2(dy, dx);
    const segment = document.createElement('span');
    segment.className = 'badge-edge';
    segment.style.left = `${100 * a.x / width}%`;
    segment.style.top = `${100 * a.y / height}%`;
    segment.style.width = `calc(${100 * Math.hypot(dx, dy) / width}% + .35px)`;
    segment.style.transform = `rotate(${angle}rad) rotateX(90deg) translateY(calc(var(--badge-depth) / -2))`;
    segment.style.setProperty('--edge-tone', `hsl(225 10% ${61 + 22 * Math.sin(angle - .8)}%)`);
    wall.append(segment);
  }
  badgeRotor.prepend(wall);
}

function idle(focus = false) {
  clearTimeout(timer);
  transitionId += 1;
  if (stage.dataset.scene === 'finale') finale.scrollTop = 0;
  filmAlignment?.cancel();
  film.pause();
  film.currentTime = filmStart;
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

function doudouPosition(video, sample, fit) {
  if (video.readyState < 2) return;
  const { width, height } = sample.canvas;
  sample.drawImage(video, 0, 0, width, height);
  const pixels = sample.getImageData(0, 0, width, height).data;
  let left = width, right = 0, top = height, bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const red = pixels[offset];
      // Locate the coral fur while leaving the black stage and cool highlights out.
      if (red < 100 || red < 1.45 * pixels[offset + 1] || red < 1.4 * pixels[offset + 2]) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right - left < width * .25 || bottom - top < height * .2) return;

  const renderedScale = fit(video.clientWidth / video.videoWidth, video.clientHeight / video.videoHeight);
  const renderedWidth = video.videoWidth * renderedScale;
  const renderedHeight = video.videoHeight * renderedScale;
  return {
    x: ((left + right + 1) / (2 * width) - .5) * renderedWidth,
    y: ((top + bottom + 1) / (2 * height) - .5) * renderedHeight,
    width: (right - left + 1) / width * renderedWidth,
  };
}

function alignFilmEntrance() {
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 128;
  const sample = canvas.getContext('2d', { willReadFrequently: true });
  if (!sample) return;

  const from = doudouPosition(idleVideo, sample, Math.min);
  const to = doudouPosition(film, sample, Math.max);
  if (!from || !to) return;

  const scale = from.width / to.width;
  const x = from.x - to.x * scale;
  const y = from.y - to.y * scale;
  filmAlignment = film.animate([
    { transform: `translate(${x}px, ${y}px) scale(${scale})` },
    { transform: 'none' },
  ], { duration: 480, easing: 'cubic-bezier(.22, .65, .35, 1)' });
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
  if (stage.dataset.scene !== 'film' || stage.hasAttribute('data-video-visible')) return;
  alignFilmEntrance();
  idleVideo.pause();
  stage.dataset.videoVisible = '';
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
  badgeButton.setAttribute('aria-pressed', 'false');
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
        rotateY: { from: -27, to: 0 },
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
  badgeButton.setAttribute('aria-pressed', String(Math.abs(Math.round(angle / 180) % 2) === 1));
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
  if (drag.moved) {
    clickAfterDrag = performance.now() + 350;
    turnBadge(Math.round(badge.angle / 180) * 180);
  }
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

buildMedalEdge();
idle();
