const stage = document.querySelector('#invitation');
const idleScreen = document.querySelector('#idle-screen');
const idleVideo = document.querySelector('#idle-video');
const opening = document.querySelector('#opening');
const openButton = document.querySelector('#open-button');
const film = document.querySelector('#film');
const filmControls = document.querySelector('#film-controls');
const playbackMessage = document.querySelector('#playback-message');
const playbackStatus = document.querySelector('#playback-status');
const playFilmButton = document.querySelector('#play-film');
const sound = document.querySelector('#sound');
const skip = document.querySelector('#skip');
const finale = document.querySelector('#finale');
const eventTitle = document.querySelector('#event-title');
const replay = document.querySelector('#replay');
const badgeButton = document.querySelector('#badge-button');
const badgeRotor = document.querySelector('#badge-rotor');
const badgeMotion = document.querySelector('.badge-motion');
const fallbackSweep = document.querySelector('#medal-sweep');
const revealItems = [...document.querySelectorAll('.reveal')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motion = window.anime;
const badge = { angle: 0, target: 0, shown: 0 };
const filmStart = 1.67;
let drag, playbackTimer, filmAlignment;
let medalRenderer;
let medalPrepared = false;
let request = 0;
let transitionId = 0;
let lastFrame = 0;
let clickAfterDrag = 0;
let ambientLight = 0;

function scene(next) {
  stage.dataset.scene = next;
  const idle = next === 'idle';
  const final = next === 'finale';
  opening.inert = !idle;
  idleScreen.inert = !idle;
  filmControls.inert = next !== 'film';
  playbackMessage.inert = true;
  finale.inert = !final;
  finale.setAttribute('aria-hidden', String(!final));
}

function frame(now) {
  request = 0;
  if (stage.dataset.scene === 'finale') {
    const elapsed = lastFrame ? Math.min(50, now - lastFrame) : 16;
    lastFrame = now;
    badge.shown += (badge.target - badge.shown) * (1 - Math.exp(-elapsed / 65));
    const floating = !drag && !reducedMotion.matches;
    const yaw = badge.shown + (floating ? Math.sin(now / 1550) * 13 : 0);
    const pitch = floating ? -4 + Math.cos(now / 1500) * 5 : 0;
    const lightTarget = floating ? Math.sin(now / 1330) * .92 : 0;
    ambientLight += (lightTarget - ambientLight) * (1 - Math.exp(-elapsed / 115));
    badgeRotor.style.transform = 'rotateX(' + pitch + 'deg) rotateY(' + yaw + 'deg)';
    medalRenderer?.render(pitch, yaw, ambientLight);
    if (!badgeMotion.classList.contains('has-real-medal')) {
      const angle = yaw * Math.PI / 180;
      const offset = (ambientLight + Math.sin(2 * angle)) * 630;
      fallbackSweep.setAttribute('gradientTransform', `translate(${offset} 0)`);
    }
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
    segment.style.setProperty('--edge-tone', `hsl(18 12% ${61 + 22 * Math.sin(angle - .8)}%)`);
    wall.append(segment);
  }
  badgeRotor.prepend(wall);
}

async function prepareMedal() {
  if (medalPrepared || !window.DoudouMedal) return;
  medalPrepared = true;
  try {
    await document.fonts.ready;
    const date = document.querySelector('.badge-date').textContent;
    medalRenderer = await window.DoudouMedal.createMedal(badgeMotion, document.querySelector('#medal-outline'), date);
    startFrames();
  } catch (error) {
    console.warn('The medal is using the CSS renderer.', error);
  }
}

function idle() {
  clearTimeout(playbackTimer);
  transitionId += 1;
  filmAlignment?.cancel();
  film.pause();
  delete stage.dataset.playback;
  delete stage.dataset.videoVisible;
  if (idleVideo.readyState > 0) idleVideo.currentTime = 0;
  scene('idle');
  if (reducedMotion.matches) idleVideo.pause();
  else idleVideo.play().catch(() => {});
  if (reducedMotion.matches) stage.dataset.prompt = '';
  else {
    delete stage.dataset.prompt;
    const id = transitionId;
    setTimeout(() => {
      if (id === transitionId) stage.dataset.prompt = '';
    }, 720);
  }
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
  if (reducedMotion.matches || typeof film.animate !== 'function') return;
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 128;
  const sample = canvas.getContext('2d', { willReadFrequently: true });
  if (!sample) return;

  const from = doudouPosition(idleVideo, sample, Math.min);
  const filmFit = getComputedStyle(film).objectFit === 'contain' ? Math.min : Math.max;
  const to = doudouPosition(film, sample, filmFit);
  if (!from || !to) return;

  const scale = from.width / to.width;
  const x = from.x - to.x * scale;
  const y = from.y - to.y * scale;
  filmAlignment = film.animate([
    { transform: `translate(${x}px, ${y}px) scale(${scale})` },
    { transform: 'none' },
  ], { duration: 480, easing: 'cubic-bezier(.22, .65, .35, 1)' });
}

function showPlaybackState(state, message = '') {
  stage.dataset.playback = state;
  playbackMessage.inert = state === 'playing';
  playbackStatus.textContent = message;
}

function waitForFilm() {
  clearTimeout(playbackTimer);
  showPlaybackState('waiting', '正在加载影片');
  playbackTimer = setTimeout(() => {
    if (stage.dataset.scene === 'film') showPlaybackState('retry', '影片加载较慢');
  }, 6500);
}

function retryPlayback() {
  clearTimeout(playbackTimer);
  showPlaybackState('retry', film.error ? '暂时无法加载影片' : '点一下继续播放影片');
}

function playFilm() {
  if (stage.dataset.scene !== 'film') return;
  const id = ++transitionId;
  if (film.error) film.load();
  // Safari requires the play request to come directly from the click.
  // Preload, seek, and the entrance effect must not delay it.
  film.play().catch(() => {
    if (id === transitionId) retryPlayback();
  });
  waitForFilm();
}

function openInvitation(event) {
  const current = stage.dataset.scene;
  if (current !== 'idle' && current !== 'finale') return;
  if (current === 'finale') finale.scrollTop = 0;
  stage.toggleAttribute('data-from-opening', current === 'idle');
  filmAlignment?.cancel();
  delete stage.dataset.videoVisible;
  // Keep the matched entrance where the browser already has that range.
  // A cold mobile load can start from frame zero immediately.
  const start = film.seekable.length && film.seekable.start(0) <= filmStart &&
    film.seekable.end(0) > filmStart ? filmStart : 0;
  if (film.readyState > 0 && film.currentTime !== start) film.currentTime = start;
  scene('film');
  playFilm();
  if (event.detail === 0) skip.focus({ preventScroll: true });
}

film.addEventListener('playing', () => {
  if (stage.dataset.scene !== 'film') return;
  clearTimeout(playbackTimer);
  showPlaybackState('playing');
  if (stage.hasAttribute('data-video-visible')) return;
  // Canvas sampling is optional. Some mobile browsers restrict video readback.
  if (stage.hasAttribute('data-from-opening')) {
    try {
      alignFilmEntrance();
    } catch {
      // The crossfade works without frame sampling.
    }
    idleVideo.pause();
  }
  stage.dataset.videoVisible = '';
});
film.addEventListener('waiting', () => {
  if (stage.dataset.scene === 'film' && stage.dataset.playback !== 'retry') waitForFilm();
});
film.addEventListener('ended', () => {
  if (stage.dataset.scene === 'film') showFinale(true);
});
film.addEventListener('error', () => {
  if (stage.dataset.scene === 'film') retryPlayback();
});
film.addEventListener('pause', () => {
  if (stage.dataset.scene === 'film' && !film.ended && !film.seeking) retryPlayback();
});

function showFinale(focus) {
  if (stage.dataset.scene === 'finale') return;
  clearTimeout(playbackTimer);
  transitionId += 1;
  film.pause();
  idleVideo.pause();
  delete stage.dataset.playback;
  badge.angle = badge.target = badge.shown = 0;
  ambientLight = 0;
  badgeButton.setAttribute('aria-pressed', 'false');
  badgeRotor.style.transform = '';
  badgeMotion.removeAttribute('style');
  revealItems.forEach(item => item.removeAttribute('style'));
  scene('finale');
  prepareMedal();
  if (reducedMotion.matches || !motion) {
    badgeMotion.style.opacity = 1;
    revealItems.forEach(item => { item.style.opacity = 1; });
  } else {
    motion.createTimeline()
      .add(badgeMotion, {
        opacity: { from: 0, to: 1, duration: 440 },
        y: { from: 32, to: 0 },
        scale: { from: .72, to: 1 },
        rotateY: { from: -18, to: 0 },
        rotateZ: { from: -8, to: 0 },
        duration: 940, ease: 'outExpo'
      }, 130)
      .add(revealItems, {
        opacity: { from: 0, to: 1 }, y: { from: 11, to: 0 },
        duration: 670, delay: motion.stagger(85), ease: 'outCubic'
      }, 380);
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

function updateSoundButton() {
  sound.setAttribute('aria-pressed', String(!film.muted));
  sound.setAttribute('aria-label', film.muted ? '开启声音' : '关闭声音');
}

sound.addEventListener('click', () => {
  film.muted = !film.muted;
  updateSoundButton();
  if (film.paused && stage.dataset.playback === 'retry') playFilm();
});
film.addEventListener('volumechange', updateSoundButton);
playFilmButton.addEventListener('click', playFilm);
idleScreen.addEventListener('click', openInvitation);
openButton.addEventListener('click', openInvitation);
skip.addEventListener('click', () => showFinale(true));
replay.addEventListener('click', openInvitation);

function updateMotionPreference() {
  if (stage.dataset.scene === 'idle') idle();
  if (reducedMotion.matches) ambientLight = 0;
  startFrames();
}
if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', updateMotionPreference);
else reducedMotion.addListener(updateMotionPreference);

buildMedalEdge();
idle();
