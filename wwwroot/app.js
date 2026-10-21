'use strict';
const $ = s => document.querySelector(s);
const audio = $('#audio'), form = $('#track-form');
let state, editingId = null, ascending = true, busy = false, currentId = null;
let audioContext, analyser, frequencyData, noticeTimer, searchController, searchVersion = 0;
const fallback = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ba602f"/><stop offset="1" stop-color="#36244e"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="150" r="95" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2"/><circle cx="150" cy="150" r="24" fill="#17121e"/><text x="150" y="273" text-anchor="middle" fill="#e9d8f4" font-family="sans-serif" font-size="16">PULSEDECK</text></svg>');
const time = seconds => `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, '0')}`;
function element(tag, className, text) { const el = document.createElement(tag); el.className = className; if (text !== undefined) el.textContent = text; return el; }
function notify(message) { $('#notice').textContent = message; $('#notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('#notice').hidden = true, 6000); }
function safeUrl(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
function image(url, className) { const img = element('img', className); img.src = safeUrl(url) || fallback; img.alt = ''; img.loading = 'lazy'; img.onerror = () => { img.onerror = null; img.src = fallback; }; return img; }
async function api(path = '', method = 'GET', data) {
  const response = await fetch('/api/cola' + path, { method, headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.mensaje || result.detail || (result.errors ? Object.values(result.errors).flat().join(' ') : result.title) || 'No se pudo completar la operación.');
  return result;
}
async function mutate(path, method = 'POST', data) {
  if (busy) return false;
  busy = true; document.body.setAttribute('aria-busy', 'true');
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { state = await api(path, method, data); render(); await searchQueue(); return true; }
  catch (error) { notify(error.message); return false; }
  finally { busy = false; document.body.removeAttribute('aria-busy'); document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
function render() {
  $('#count').textContent = String(state.cantidad).padStart(2, '0');
  $('#queue-summary').textContent = `${state.cantidad} nodos conectados · termina en NULL`;
  $('#telemetry').textContent = state.ultimoLog;
  form.elements.posicion.max = state.cantidad;
  renderQueue(state.nodos);
  const track = state.pistaActual;
  if (track && track.id !== currentId) {
    currentId = track.id; audio.pause();
    const src = safeUrl(track.audioPreviewUrl);
    if (src) audio.src = src; else { audio.removeAttribute('src'); notify('Esta pista no tiene preview. Puedes seguir administrando la cola.'); }
    audio.load();
    $('#current-title').textContent = track.titulo; $('#current-artist').textContent = track.artista;
    const art = image(track.thumbnailUrl, '');
    art.onload = () => { $('.disc-art').style.backgroundImage = `url(${JSON.stringify(art.src)})`; };
    $('.disc-art').style.backgroundImage = `url(${JSON.stringify(fallback)})`;
  }
}
function renderQueue(nodes, matches) {
  const queue = $('#queue'); queue.replaceChildren();
  const visible = matches ? nodes.filter(n => matches.has(n.idActual)) : nodes;
  if (!visible.length) { queue.append(element('div', 'empty-state', nodes.length ? 'No hay coincidencias. Prueba otro título o artista.' : 'Tu cola está vacía.\nAgrega una pista para crear el primer enlace.')); return; }
  visible.forEach((node, index) => {
    const p = node.pista, card = element('article', 'track-card border-glow');
    card.dataset.id = p.id;
    card.append(element('span', 'node-index', String(node.indice).padStart(2, '0')), image(p.thumbnailUrl, 'cover'));
    const info = element('div', 'track-info');
    info.append(element('h3', 'track-name', p.titulo), element('p', 'track-artist', p.artista));
    const tag = element('span', 'node-tag', `Nodo #${node.indice} → Sig: ${node.idSiguiente === 'NULL' ? 'NULL' : node.idSiguiente.slice(0, 6)}${node.idSiguiente === 'NULL' ? '' : '…'}`);
    tag.title = `ID: ${node.idActual} → Siguiente: ${node.idSiguiente}`; info.append(tag);
    const meta = element('div', 'track-meta'), metrics = element('div', 'metrics');
    metrics.append(element('b', '', `${p.bpm} BPM`), element('span', '', `P${p.prioridad}`));
    const actions = element('div', 'card-actions');
    const edit = element('button', 'border-glow', '✎'); edit.setAttribute('aria-label', `Editar ${p.titulo}`); edit.onclick = () => startEdit(p);
    const remove = element('button', 'border-glow', '×'); remove.setAttribute('aria-label', `Eliminar ${p.titulo}`); remove.onclick = () => mutate('/' + p.id, 'DELETE');
    const handle = element('button', 'drag-handle border-glow', '⠿');
    handle.type = 'button'; handle.setAttribute('aria-label', `Mover ${p.titulo}. Arrastra o usa las flechas arriba y abajo.`);
    handle.title = 'Arrastra para mover · ↑ / ↓ con teclado';
    handle.onpointerdown = event => beginDrag(event, card, handle, node);
    handle.onkeydown = async event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const position = node.indice + (event.key === 'ArrowUp' ? -1 : 1);
      if (position >= 0 && position < state.cantidad && !busy) await moveTrack(p.id, position);
    };
    actions.append(handle, edit, remove); meta.append(metrics, element('small', '', time(p.duracionSegundos)), actions); card.append(info, meta); queue.append(card);
    if (index < visible.length - 1 && !matches) queue.append(element('div', 'connector', '↓ .Siguiente'));
  });
}
async function moveTrack(id, position) {
  if (await mutate(`/${encodeURIComponent(id)}/posicion/${position}`, 'PUT')) {
    document.querySelectorAll('.sort').forEach(button => button.classList.remove('active'));
    notify(`Canción movida a la posición ${position + 1}.`);
    const card = Array.from(document.querySelectorAll('.track-card')).find(item => item.dataset.id === id);
    card?.querySelector('.drag-handle')?.focus({ preventScroll: true });
  }
}
function beginDrag(event, card, handle, node) {
  if (busy || state.cantidad < 2 || event.button !== 0) return;
  event.preventDefault();
  const startY = event.clientY;
  let y = startY, active = false, target = null, after = false, frame = 0;
  handle.setPointerCapture(event.pointerId);
  function clearTarget() { target?.classList.remove('drop-before', 'drop-after'); target = null; }
  function update() {
    frame = 0;
    if (!active) return;
    const boundary = Math.min(90, innerHeight / 5);
    if (y < boundary) window.scrollBy(0, -Math.ceil((boundary - y) / 5));
    else if (y > innerHeight - boundary) window.scrollBy(0, Math.ceil((y - innerHeight + boundary) / 5));
    const candidates = Array.from(document.querySelectorAll('.track-card')).filter(item => item !== card);
    let closest = null, distance = Infinity;
    for (const item of candidates) {
      const rect = item.getBoundingClientRect(), center = rect.top + rect.height / 2;
      if (Math.abs(y - center) < distance) { distance = Math.abs(y - center); closest = item; }
    }
    clearTarget(); target = closest;
    if (target) { const rect = target.getBoundingClientRect(); after = y > rect.top + rect.height / 2; target.classList.add(after ? 'drop-after' : 'drop-before'); }
    frame = requestAnimationFrame(update);
  }
  function move(e) {
    y = e.clientY;
    if (!active && Math.abs(y - startY) > 5) { active = true; card.classList.add('dragging'); document.body.classList.add('reordering'); }
    if (active && !frame) frame = requestAnimationFrame(update);
  }
  function finish(e) {
    const destination = target ? state.nodos.find(n => n.idActual === target.dataset.id) : null;
    let position = destination ? destination.indice + (after ? 1 : 0) : node.indice;
    if (destination && node.indice < position) position--;
    const shouldMove = active && destination && position !== node.indice && e.type === 'pointerup';
    cancelAnimationFrame(frame); clearTarget(); card.classList.remove('dragging'); document.body.classList.remove('reordering');
    handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', finish); handle.removeEventListener('lostpointercapture', finish);
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (shouldMove) moveTrack(node.idActual, position);
  }
  handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish); handle.addEventListener('lostpointercapture', finish);
}
let selectedTrack = false;
function toggleManual(open) {
  $('#manual-fields').hidden = !open;
  $('#toggle-filters').setAttribute('aria-expanded', String(open));
  $('#insert-actions').hidden = Boolean(editingId) || !(open || selectedTrack);
}
$('#toggle-filters').onclick = () => {
  if (editingId) { cancelEdit(); return; }
  toggleManual($('#manual-fields').hidden);
};
form.addEventListener('invalid', () => toggleManual(true), true);
function showSelection(track) {
  selectedTrack = true;
  const summary = $('#selected-track'); summary.replaceChildren(); summary.hidden = false;
  const info = element('div', ''); info.append(element('strong', '', track.trackName), element('small', '', track.artistName));
  summary.append(image(track.artworkUrl100, 'selection-cover'), info, element('span', 'selected-label', 'PRÓXIMO EN TU MIX'));
  $('#insert-actions').hidden = Boolean(editingId);
}
function startEdit(p) { editingId = p.id; for (const [key, value] of Object.entries(p)) if (form.elements[key]) form.elements[key].value = value; $('#selected-track').hidden = true; toggleManual(true); $('#edit-actions').hidden = false; $('#form-title').textContent = 'EDITA EL NODO'; form.scrollIntoView({ behavior: 'smooth', block: 'center' }); form.elements.titulo.focus({ preventScroll: true }); }
function cancelEdit() { editingId = null; selectedTrack = false; form.reset(); $('#selected-track').hidden = true; $('#edit-actions').hidden = true; $('#form-title').textContent = 'O INGRESA LOS DATOS'; toggleManual(false); }
$('#clear-selection').onclick = cancelEdit;
$('#cancel-edit').onclick = cancelEdit;
form.onsubmit = async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form));
  for (const key of ['duracionSegundos', 'bpm', 'prioridad']) payload[key] = Number(payload[key]);
  const position = Number(payload.posicion); delete payload.posicion;
  const destino = event.submitter?.dataset.destino || 'final';
  const path = editingId ? '/' + editingId : '/' + destino + (destino === 'posicion' ? '/' + position : '');
  if (await mutate(path, editingId ? 'PUT' : 'POST', payload)) { cancelEdit(); notify('Cola actualizada. Enlaces listos.'); }
};
async function searchQueue() {
  const version = ++searchVersion, q = $('#queue-search').value.trim();
  if (!q) { renderQueue(state.nodos); $('#search-info').textContent = 'Empieza en Cabeza. Sigue cada .Siguiente.'; return; }
  try {
    const result = await api('/buscar?q=' + encodeURIComponent(q));
    if (version !== searchVersion) return;
    renderQueue(state.nodos, new Set(result.coincidencias.map(m => m.pista.id)));
    $('#search-info').textContent = result.coincidencias.length ? `${result.coincidencias.length} coincidencia(s) · saltos por resultado: ${result.coincidencias.map(m => '#' + m.indice + ': ' + m.saltos).join(', ')} · total: ${result.saltosTotales} saltos (incluye NULL).` : `Sin coincidencias · ${result.saltosTotales} saltos de puntero .Siguiente (incluye NULL).`;
  } catch (error) { if (version === searchVersion) notify(error.message); }
}
let queueTimer;
$('#queue-search').oninput = () => { ++searchVersion; clearTimeout(queueTimer); queueTimer = setTimeout(searchQueue, 200); };
$('#direction').onclick = () => { ascending = !ascending; $('#direction').textContent = ascending ? '↑ Asc.' : '↓ Desc.'; };
document.querySelectorAll('.sort').forEach(button => button.onclick = async () => { if (await mutate(`/ordenar?criterio=${button.dataset.criterio}&asc=${ascending}`)) { document.querySelectorAll('.sort').forEach(b => b.classList.toggle('active', b === button)); } });
$('#reverse').onclick = () => mutate('/invertir'); $('#remove-last').onclick = () => mutate('/final', 'DELETE');
let itunesTimer;
$('#itunes').oninput = () => {
  clearTimeout(itunesTimer); searchController?.abort();
  const q = $('#itunes').value.trim(); $('#itunes-results').replaceChildren();
  if (q.length < 2) return;
  itunesTimer = setTimeout(async () => {
    const controller = new AbortController(); searchController = controller;
    $('#itunes-results').textContent = 'Buscando…';
    try {
      const response = await fetch('https://itunes.apple.com/search?media=music&entity=song&limit=5&term=' + encodeURIComponent(q), { signal: controller.signal });
      if (!response.ok) throw new Error();
      const data = await response.json(); if (controller.signal.aborted) return;
      $('#itunes-results').replaceChildren();
      if (!data.results.length) $('#itunes-results').textContent = 'Sin resultados. Puedes ingresar la pista manualmente.';
      data.results.forEach(track => {
        const b = element('button', 'itunes-result border-glow'); b.type = 'button';
        const label = element('span', '', track.trackName); label.append(element('small', '', track.artistName)); b.append(image(track.artworkUrl100, ''), label);
        b.onclick = () => { form.elements.titulo.value = track.trackName; form.elements.artista.value = track.artistName; form.elements.duracionSegundos.value = Math.max(1, Math.round(track.trackTimeMillis / 1000)); form.elements.thumbnailUrl.value = track.artworkUrl100.replace('100x100bb', '600x600bb'); form.elements.audioPreviewUrl.value = track.previewUrl || ''; $('#itunes-results').replaceChildren(); $('#itunes').value = ''; showSelection(track); notify('Elige Inicio, Final o Posición. En Filtros puedes ajustar BPM y prioridad.'); };
        $('#itunes-results').append(b);
      });
    } catch (error) { if (error.name !== 'AbortError') $('#itunes-results').textContent = 'iTunes no está disponible. Usa el ingreso manual.'; }
  }, 300);
};
async function unlockAudio() {
  if (!audioContext) { const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return; audioContext = new Context(); analyser = audioContext.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = .82; frequencyData = new Uint8Array(analyser.frequencyBinCount); const source = audioContext.createMediaElementSource(audio); source.connect(analyser); analyser.connect(audioContext.destination); }
  if (audioContext.state === 'suspended') await audioContext.resume();
}
async function playAudio() { if (!audio.getAttribute('src')) { notify('La pista no tiene preview disponible.'); return; } try { await unlockAudio(); await audio.play(); } catch { notify('No se pudo reproducir el preview. Pulsa reproducir para reintentar o avanza de pista.'); } }
async function nextTrack() {
  if (busy) return;
  try { await unlockAudio(); } catch { notify('El navegador no pudo activar el visualizador.'); }
  if (!state?.cantidad) { audio.pause(); notify('La cola está vacía. Agrega otra canción.'); return; }
  if (await mutate('/inicio', 'DELETE')) await playAudio();
}
$('#next').onclick = nextTrack;
$('#play').onclick = () => { if (!currentId) nextTrack(); else if (audio.paused) playAudio(); else audio.pause(); };
audio.onplay = () => { $('.cd-disc').classList.add('playing'); $('#play').textContent = 'Ⅱ'; $('#play-status').textContent = 'REPRODUCIENDO'; };
audio.onpause = () => { $('.cd-disc').classList.remove('playing'); $('#play').textContent = '▶'; $('#play-status').textContent = 'EN PAUSA'; };
audio.onended = () => { if (state.cantidad) nextTrack(); else { $('#play-status').textContent = 'FIN DE LA COLA'; notify('La sesión terminó. Agrega nuevos nodos para continuar.'); } };
audio.onerror = () => { if (audio.getAttribute('src')) { audio.pause(); notify('El preview no está disponible o el proveedor bloqueó el audio. Puedes avanzar a la siguiente pista.'); } };
audio.ontimeupdate = () => { $('#elapsed').textContent = time(audio.currentTime); $('#total-time').textContent = time(Number.isFinite(audio.duration) ? audio.duration : 30); $('#progress-fill').style.width = `${Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0}%`; };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Rotating Text: staggered vertical character transitions, without a framework.
const rotatingWord = $('.rotating-word'), rotatingWords = ['ritmo.', 'momento.', 'universo.'];
let rotatingIndex = 0, rotatingTimer = null, rotationVersion = 0;
function setRotatingWord(word) {
  rotatingWord.replaceChildren(...Array.from(word, character => element('span', 'rotating-char', character)));
}
function pauseRotation() {
  clearTimeout(rotatingTimer); rotatingTimer = null; rotationVersion++;
  rotatingWord.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
}
function scheduleRotation() {
  pauseRotation();
  if (reducedMotion.matches || document.hidden) return;
  const version = rotationVersion;
  rotatingTimer = setTimeout(async () => {
    const exit = Array.from(rotatingWord.children, (character, i) => character.animate(
      [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-125%)', opacity: 0 }],
      { duration: 270, delay: i * 22, easing: 'cubic-bezier(.55,0,.8,.4)', fill: 'forwards' }));
    await Promise.all(exit.map(animation => animation.finished.catch(() => {})));
    if (version !== rotationVersion) return;
    rotatingIndex = (rotatingIndex + 1) % rotatingWords.length;
    setRotatingWord(rotatingWords[rotatingIndex]);
    const enter = Array.from(rotatingWord.children, (character, i) => character.animate(
      [{ transform: 'translateY(125%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 450, delay: i * 26, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }));
    await Promise.all(enter.map(animation => animation.finished.catch(() => {})));
    if (version === rotationVersion) scheduleRotation();
  }, 2600);
}
setRotatingWord(rotatingWords[0]); scheduleRotation();
document.addEventListener('visibilitychange', scheduleRotation);
reducedMotion.addEventListener('change', () => { setRotatingWord(rotatingWords[rotatingIndex]); scheduleRotation(); });
const canvas = $('#spectrum'), ctx = canvas.getContext('2d');
function drawSpectrum() {
  const w = Math.round(canvas.clientWidth * devicePixelRatio), h = Math.round(canvas.clientHeight * devicePixelRatio);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.clearRect(0, 0, w, h);
  if (analyser) analyser.getByteFrequencyData(frequencyData);
  const gradient = ctx.createLinearGradient(0, 0, w, 0); gradient.addColorStop(0, '#ff6b2b'); gradient.addColorStop(1, '#8b5cf6'); ctx.fillStyle = gradient;
  const bars = 48, gap = 3 * devicePixelRatio, bw = Math.max(1, w / bars - gap);
  for (let i = 0; i < bars; i++) { const value = analyser && !audio.paused && !reducedMotion.matches ? frequencyData[i] / 255 : 0; const height = Math.max(2 * devicePixelRatio, value * h * .95); ctx.globalAlpha = value ? .8 : .22; ctx.fillRect(i * w / bars, (h - height) / 2, bw, height); }
  ctx.globalAlpha = 1; requestAnimationFrame(drawSpectrum);
}
drawSpectrum();
const stage = $('.cd-stage'), jewel = $('.jewel-case-3d'); let dragging = false, rx = 8, ry = -14;
function tilt(x, y) { if (reducedMotion.matches) return; rx = Math.max(-30, Math.min(30, x)); ry = Math.max(-30, Math.min(30, y)); jewel.style.setProperty('--rot-x', rx + 'deg'); jewel.style.setProperty('--rot-y', ry + 'deg'); jewel.style.setProperty('--shine-angle', (135 + ry * 2) + 'deg'); }
stage.onpointerdown = event => { dragging = true; stage.setPointerCapture(event.pointerId); };
stage.onpointermove = event => { if (event.pointerType !== 'mouse' && !dragging) return; const rect = stage.getBoundingClientRect(); tilt(-(event.clientY - rect.top - rect.height / 2) / rect.height * 60, (event.clientX - rect.left - rect.width / 2) / rect.width * 60); };
function resetTilt() { dragging = false; tilt(8, -14); }
stage.onpointerup = resetTilt; stage.onpointercancel = resetTilt; stage.onpointerleave = () => { if (!dragging) resetTilt(); };
stage.onkeydown = event => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home'].includes(event.key)) { event.preventDefault(); if (event.key === 'Home') resetTilt(); else tilt(rx + (event.key === 'ArrowUp' ? -5 : event.key === 'ArrowDown' ? 5 : 0), ry + (event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0)); } };
let glowFrame = 0, pointerX = -9999, pointerY = -9999;
function updateGlow() { glowFrame = 0; document.querySelectorAll('.border-glow').forEach(el => { const r = el.getBoundingClientRect(), x = pointerX - r.left, y = pointerY - r.top; const outside = Math.hypot(Math.max(-x, 0, x - r.width), Math.max(-y, 0, y - r.height)); const inside = x >= 0 && x <= r.width && y >= 0 && y <= r.height; const distance = inside ? Math.min(x, y, r.width - x, r.height - y) : outside; const opacity = Math.max(0, 1 - distance / 100); el.style.setProperty('--glow-opacity', opacity); if (opacity) { el.style.setProperty('--mouse-x', x + 'px'); el.style.setProperty('--mouse-y', y + 'px'); } }); }
document.addEventListener('pointermove', event => { pointerX = event.clientX; pointerY = event.clientY; if (!glowFrame) glowFrame = requestAnimationFrame(updateGlow); }, { passive: true });
document.addEventListener('pointerleave', () => { pointerX = pointerY = -9999; updateGlow(); });
api().then(result => { state = result; render(); }).catch(error => { $('#telemetry').textContent = 'Sin conexión con el backend.'; $('#queue').append(element('div', 'empty-state', 'No se pudo cargar la cola. Recarga la página para reintentar.')); notify(error.message); });
