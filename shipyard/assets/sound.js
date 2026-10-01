/* Kex Shipyard — sound. Interface blips and a soft engine-room hum are synthesized in the browser (Web Audio), so
   they cost no downloads. The tutorial voice plays recorded lines from assets/voice/ when they exist and match the
   current text. Off by default; the choice is remembered on this device. */
(function () {
  'use strict';
  const KEY = 'kex-shipyard:sound';
  const read = () => { try { return localStorage.getItem(KEY) === 'on'; } catch (e) { return false; } };
  const write = (v) => { try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) { /* private mode */ } };
  let on = read(); let ctx = null; let master = null; let amb = null; let voice = null; let lines = null; let gestured = false;

  function ensure() {
    if (!gestured) return null; // browsers only allow audio after a click, tap or key press
    if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return ctx; } // 'suspended', or iOS 'interrupted'
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    return ctx;
  }
  function tone({ f = 880, f2 = 0, type = 'sine', dur = 0.08, vol = 0.1, delay = 0 }) {
    if (!on || !ensure()) return;
    const t = ctx.currentTime + delay; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  function brown(seconds) { // soft brown noise
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate); const d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
  }
  function whoosh(vol, dur) {
    if (!on || !ensure()) return;
    const t = ctx.currentTime; const s = ctx.createBufferSource(); s.buffer = brown(dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2400, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t);
  }
  const fx = {
    click: () => tone({ f: 1400, f2: 1000, type: 'triangle', dur: 0.045, vol: 0.05 }),
    nav: () => tone({ f: 660, f2: 990, dur: 0.07, vol: 0.05 }),
    step: () => { tone({ f: 520, dur: 0.06, vol: 0.06 }); tone({ f: 780, dur: 0.08, vol: 0.05, delay: 0.06 }); },
    open: () => { whoosh(0.06, 0.3); tone({ f: 300, f2: 900, dur: 0.25, vol: 0.035 }); },
    ok: () => [523, 659, 784].forEach((f, i) => tone({ f, dur: 0.18, vol: 0.05, delay: i * 0.07 })),
    err: () => tone({ f: 220, f2: 160, type: 'square', dur: 0.16, vol: 0.03 }),
  };
  // A low engine-room hum: filtered brown noise that breathes slowly, plus a faint 55 Hz drone.
  function ambient(start) {
    if (!start) {
      if (amb && ctx) { const a = amb; amb = null; a.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); setTimeout(() => { try { a.src.stop(); a.o.stop(); a.lfo.stop(); } catch (e) { /* already stopped */ } }, 1500); }
      return;
    }
    if (amb || !ensure()) return;
    const buf = brown(12); const d = buf.getChannelData(0); const M = Math.floor(ctx.sampleRate * 0.25);
    for (let k = 0; k < M; k++) { const i = d.length - M + k; d[i] = d[i] * (1 - k / M) + d[0] * (k / M); } // seamless loop
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lfoG = ctx.createGain(); lfoG.gain.value = 40; lfo.connect(lfoG); lfoG.connect(lp.frequency);
    const o = ctx.createOscillator(); o.frequency.value = 55; const og = ctx.createGain(); og.gain.value = 0.15;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    src.connect(lp); lp.connect(g); o.connect(og); og.connect(g); g.connect(master);
    src.start(); o.start(); lfo.start(); g.gain.setTargetAtTime(0.05, ctx.currentTime, 1.2);
    amb = { src, o, lfo, g };
  }

  // ---- tutorial voice: assets/voice/manifest.json = { lines: { id: { file, hash } } }; a line plays only if the text it
  // was recorded from still matches (hash of the step's HTML), so edited steps never play stale audio.
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  let loading = null; let ticket = 0;
  function loadLines() {
    if (!loading) {
      loading = fetch(`assets/voice/manifest.json?v=${encodeURIComponent(window.KEX_ASSET_VERSION || '')}`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((j) => { lines = j && j.lines ? j.lines : {}; }).catch(() => { lines = {}; loading = null; }); // retried on the next line
    }
    return loading;
  }
  function stopVoice() { ticket += 1; if (voice) { voice.pause(); voice = null; } }
  // The list may still be loading (the step right after "Sound on" speaks at once): wait for it, but only play if the
  // tutorial is still on that step (the ticket changes on every new step or stop).
  function speak(id, html) {
    stopVoice();
    if (!on) return;
    const mine = ticket;
    loadLines().then(() => {
      if (mine !== ticket || !on || !lines[id] || lines[id].hash !== hash(html)) return;
      voice = new Audio(`assets/voice/${lines[id].file}?h=${lines[id].hash}`); voice.volume = 0.95;
      voice.play().catch(() => {});
    });
  }

  function setOn(v) {
    on = !!v; write(on);
    if (on) { ensure(); loadLines(); ambient(true); fx.ok(); } else { stopVoice(); ambient(false); }
    window.dispatchEvent(new Event('kex-sound')); // lets the top bar redraw its Sound button
  }
  // Browsers only allow sound after a click or tap: a remembered "on" starts at the first one.
  const wake = () => {
    gestured = true;
    if (on) { ensure(); loadLines(); ambient(true); }
    document.removeEventListener('pointerdown', wake, true); document.removeEventListener('keydown', wake, true);
  };
  document.addEventListener('pointerdown', wake, true); document.addEventListener('keydown', wake, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && on && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });
  document.addEventListener('click', (e) => { if (on && e.target.closest && e.target.closest('button, a, .zone, .node')) fx.click(); }, true);
  window.addEventListener('hashchange', () => { if (on) fx.nav(); });

  // Fetch the small voice list up front: Safari (iPhone) only lets sound start inside the tap itself, so the line right
  // after "Sound on" must not wait for a download.
  loadLines();

  const chosen = () => { try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; } };
  window.KexSound = { on: () => on, chosen, toggle: () => setOn(!on), set: setOn, fx, speak, stopVoice, hash };
})();
