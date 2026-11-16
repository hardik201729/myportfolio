/* Hardik Jain portfolio: interactions shared by the home page and case pages */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const EMAIL = 'hardik201729@gmail.com';
  const inCase = /\/cases\//.test(location.pathname);
  const root = inCase ? '../' : '';

  /* ---------- toast ---------- */
  const toastEl = $('#toast');
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2000);
  }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || 'Copied'); } catch (e) { toast(text); }
  }

  /* ---------- top bar ---------- */
  const bar = $('.topbar');
  /* mobile menu: the nav links fold into a dropdown on small screens */
  const navEl = $('.topbar .nav');
  if (bar && navEl && $$('a:not(.cta)', navEl).length) {
    const mb = document.createElement('button');
    mb.className = 'menu-btn'; mb.type = 'button';
    mb.setAttribute('aria-expanded', 'false'); mb.setAttribute('aria-label', 'Open menu');
    mb.innerHTML = '<span></span><span></span>';
    navEl.appendChild(mb);
    const setMenu = on => { bar.classList.toggle('menu-open', on); mb.setAttribute('aria-expanded', String(on)); mb.setAttribute('aria-label', on ? 'Close menu' : 'Open menu'); };
    mb.addEventListener('click', e => { e.stopPropagation(); setMenu(!bar.classList.contains('menu-open')); });
    $$('a', navEl).forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('click', e => { if (!bar.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  }
  const onScroll = () => bar && bar.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- reveal ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    const els = $$('.rv').filter(el => el.getBoundingClientRect().top > window.innerHeight);
    els.forEach(el => el.classList.add('pre'));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
  }

  /* ---------- calm mode ---------- */
  const calmBtn = $('#calmBtn');
  function setCalm(on) {
    document.body.classList.toggle('calm', on);
    if (calmBtn) { calmBtn.setAttribute('aria-pressed', String(on)); calmBtn.textContent = on ? 'Motion off' : 'Motion on'; }
    store.set('hj-calm', on ? '1' : '0');
  }
  if (calmBtn) calmBtn.addEventListener('click', () => setCalm(!document.body.classList.contains('calm')));
  if (store.get('hj-calm') === '1') setCalm(true);
  const calm = () => reduce || document.body.classList.contains('calm');

  /* ---------- draft mode: D highlights placeholder numbers ---------- */
  document.addEventListener('keydown', e => {
    if (e.key && e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey && !/input|textarea/i.test(e.target.tagName)) {
      document.body.classList.toggle('draft');
    }
  });

  /* ---------- copy email ---------- */
  const copyBtn = $('#copyEmail');
  if (copyBtn) copyBtn.addEventListener('click', () => copy(copyBtn.dataset.email, 'Email copied'));

  /* ======================================================
     SOUND: everything is synthesised, nothing downloaded
     ====================================================== */
  const Sound = (() => {
    let ctx = null, master = null;
    let on = store.get('hj-sound') !== '0';
    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      return ctx;
    }
    // audio can only start after a user gesture
    const unlock = () => {
      const c = ensure(); if (!c) return;
      const done = () => document.dispatchEvent(new CustomEvent('sound-ready'));
      if (c.state === 'suspended') c.resume().then(done); else done();
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
    const ready = () => on && ctx && ctx.state === 'running';

    function env(g, t, a, peak, d) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
    function tone({ f = 440, type = 'sine', t = 0, a = 0.01, d = 0.2, v = 0.2, to = null, filt = null, dest = master }) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
      let n = o;
      if (filt) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); n = fl; }
      n.connect(g); g.connect(dest); env(g, t, a, v, d);
      o.start(t); o.stop(t + a + d + 0.05);
      return o;
    }
    function noiseBuf(sec) {
      const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      return b;
    }

    /* little UI blip */
    function blip(hi) { if (!ready()) return; const t = ctx.currentTime; tone({ f: hi ? 880 : 660, to: hi ? 1320 : 990, d: 0.08, v: 0.05, type: 'triangle', t }); }

    /* web-shooter "thwip" */
    function thwip() {
      if (!ready()) return;
      const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      src.buffer = b; f.type = 'bandpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(5000, t + 0.18);
      src.connect(f); f.connect(g); g.connect(master); env(g, t, 0.01, 0.25, 0.2);
      src.start(t); src.stop(t + 0.3);
    }

    /* bubbly pop, pitch varies a little each time */
    function pop() {
      if (!ready()) return;
      const t = ctx.currentTime, k = 0.85 + Math.random() * 0.35;
      tone({ f: 520 * k, to: 1500 * k, type: 'sine', t, a: 0.004, d: 0.06, v: 0.22 });
      tone({ f: 1800 * k, to: 900 * k, type: 'triangle', t: t + 0.05, a: 0.002, d: 0.05, v: 0.05 });
    }

    /* an original suspense cue: low drone, ticking strings, timpani, a rising stab */
    let cue = null;
    function suspense() {
      if (!ready()) return;
      stopSuspense();
      const t0 = ctx.currentTime + 0.05;
      const bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(master);
      bus.gain.exponentialRampToValueAtTime(0.5, t0 + 0.4);
      const nodes = [];
      // drone
      [55, 55.4, 82.4].forEach(fr => {
        const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = fr; fl.type = 'lowpass'; fl.frequency.setValueAtTime(180, t0); fl.frequency.linearRampToValueAtTime(700, t0 + 5);
        g.gain.value = 0.09; o.connect(fl); fl.connect(g); g.connect(bus); o.start(t0); nodes.push(o);
      });
      // staccato string ostinato in a minor key, speeding up
      const pat = [220, 220, 261.6, 220, 293.7, 220, 329.6, 311.1];
      let t = t0, step = 0.19;
      for (let i = 0; i < 26; i++) {
        const f = pat[i % pat.length] * (i >= 16 ? 2 : 1);
        tone({ f, type: 'sawtooth', t, a: 0.005, d: 0.11, v: 0.06, filt: 2400, dest: bus });
        t += step; step = Math.max(0.12, step * 0.985);
      }
      // timpani hits
      [0, 1.52, 3.04, 3.8, 4.18].forEach(dt => tone({ f: 110, to: 55, type: 'sine', t: t0 + dt, a: 0.005, d: 0.6, v: 0.35, dest: bus }));
      // final stab
      const end = t;
      [220, 261.6, 329.6, 440].forEach(f => tone({ f, type: 'sawtooth', t: end, a: 0.01, d: 1.4, v: 0.05, filt: 3000, dest: bus }));
      tone({ f: 82.4, to: 41, type: 'sine', t: end, a: 0.005, d: 1.2, v: 0.4, dest: bus });
      bus.gain.setValueAtTime(0.5, end + 0.6);
      bus.gain.exponentialRampToValueAtTime(0.0001, end + 2.2);
      nodes.forEach(o => o.stop(end + 2.3));
      cue = { bus, nodes };
    }
    function stopSuspense() {
      if (!cue || !ctx) return;
      const { bus, nodes } = cue, t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value || 0.0001, t);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      nodes.forEach(o => { try { o.stop(t + 0.45); } catch (e) {} });
      cue = null;
    }

    /* night: crickets, frogs and a little wind */
    let night = null;
    function nightStart() {
      if (!ready() || night) return;
      const bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(master);
      bus.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 3);
      const wind = ctx.createBufferSource(), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
      wind.buffer = noiseBuf(4); wind.loop = true; wf.type = 'lowpass'; wf.frequency.value = 380; wg.gain.value = 0.05;
      wind.connect(wf); wf.connect(wg); wg.connect(bus); wind.start();
      const timers = [];
      const pan = v => { const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) { p.pan.value = v; p.connect(bus); return p; } return bus; };
      function cricket(freq, side) {
        const out = pan(side);
        const loop = () => {
          if (!night) return;
          const t = ctx.currentTime;
          for (let i = 0; i < 3; i++) tone({ f: freq, type: 'sine', t: t + i * 0.045, a: 0.004, d: 0.026, v: 0.035, dest: out });
          timers.push(setTimeout(loop, 650 + Math.random() * 700));
        };
        loop();
      }
      function frog() {
        if (!night) return;
        const t = ctx.currentTime, out = pan(Math.random() * 1.6 - 0.8);
        const croak = (st, base) => {
          const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), am = ctx.createGain(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(base, st); o.frequency.exponentialRampToValueAtTime(base * 0.8, st + 0.22);
          lfo.type = 'square'; lfo.frequency.value = 28 + Math.random() * 10; lg.gain.value = 0.5; am.gain.value = 0.5;
          lfo.connect(lg); lg.connect(am.gain);
          bp.type = 'bandpass'; bp.frequency.value = 520 + Math.random() * 200; bp.Q.value = 4;
          o.connect(am); am.connect(bp); bp.connect(g); g.connect(out);
          env(g, st, 0.02, 0.22, 0.22);
          o.start(st); lfo.start(st); o.stop(st + 0.3); lfo.stop(st + 0.3);
        };
        const base = 95 + Math.random() * 60;
        croak(t, base);
        if (Math.random() < 0.55) croak(t + 0.32, base * 1.05);
        timers.push(setTimeout(frog, 1400 + Math.random() * 3200));
      }
      night = { bus, wind, timers };
      cricket(4300, -0.6); cricket(4700, 0.5);
      timers.push(setTimeout(frog, 900));
    }
    function nightStop() {
      if (!night) return;
      const { bus, wind, timers } = night, t = ctx.currentTime;
      night = null; timers.forEach(clearTimeout);
      bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value || 0.0001, t);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      try { wind.stop(t + 0.9); } catch (e) {}
    }
    function setOn(v) { on = v; store.set('hj-sound', v ? '1' : '0'); if (!v) { nightStop(); stopSuspense(); } }
    return { blip, thwip, pop, ready: () => !!ctx && ctx.state === 'running', unlock, suspense, stopSuspense, nightStart, nightStop, setOn, isOn: () => on, ensure };
  })();

  /* ======================================================
     SPIDER DIALOG: the one bait button on this site
     ====================================================== */
  const WebModal = (() => {
    const el = document.createElement('div');
    el.className = 'web-modal'; el.id = 'webModal';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'wmTitle');
    const spider = '<svg viewBox="0 0 46 44" aria-hidden="true"><g stroke="#0B0C10" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M17 20 L6 12 L2 4"/><path d="M16 24 L4 22 L0 14"/><path d="M17 28 L5 32 L2 42"/><path d="M19 30 L12 40 L12 44"/><path d="M29 20 L40 12 L44 4"/><path d="M30 24 L42 22 L46 14"/><path d="M29 28 L41 32 L44 42"/><path d="M27 30 L34 40 L34 44"/></g><ellipse cx="23" cy="26" rx="8" ry="10" fill="#0B0C10"/><circle cx="23" cy="14" r="6" fill="#0B0C10"/><circle cx="20.5" cy="13" r="1.6" fill="#fff"/><circle cx="25.5" cy="13" r="1.6" fill="#fff"/></svg>';
    el.innerHTML = `
      <div class="wm-backdrop" data-close></div>
      <div class="wm-card">
        <div class="wm-band">
          <svg class="wm-web" viewBox="0 0 230 190" aria-hidden="true"><path d="M0 0 L230 40 M0 0 L200 120 M0 0 L120 190 M0 0 L30 190"/><path d="M60 11 Q52 40 52 53 Q35 65 28 76 Q14 80 8 76"/><path d="M115 20 Q100 70 104 106 Q72 125 60 152 Q28 155 16 152"/><path d="M175 31 Q150 100 156 160 Q110 170 92 190"/></svg>
          <div class="wm-burst">NDA!</div>
          <div class="wm-spider"><div class="thread"></div>${spider}</div>
          <h2>Your friendly neighbourhood NDA.</h2>
        </div>
        <button class="wm-close" data-close aria-label="Close">✕</button>
        <div class="wm-body">
          <div class="wm-case" id="wmCase"></div>
          <h3 id="wmTitle"></h3>
          <div class="wm-callout" id="wmCallout"></div>
          <p class="wm-text" id="wmText"></p>
          <div class="wm-sense">
            <div class="k"><span>Spider-sense reading</span><span id="wmPct">scanning…</span></div>
            <div class="wm-meter"><i id="wmMeter"></i></div>
            <div class="wm-who" id="wmWho">
              <button aria-pressed="false" data-who="Recruiter">Recruiter</button>
              <button aria-pressed="false" data-who="Hiring manager">Hiring manager</button>
              <button aria-pressed="false" data-who="Fellow PM">Fellow PM</button>
              <button aria-pressed="false" data-who="Just curious">Just curious</button>
            </div>
          </div>
          <div class="wm-cta-wrap">
            <span class="wm-mini">${spider}</span>
            <a class="wm-cta" id="wmCta" href="#">Request a walkthrough <span aria-hidden="true">→</span></a>
          </div>
          <p class="wm-tag" id="wmTag">It doesn't bite. It only eats scope creep.</p>
          <div class="wm-mail"><span>${EMAIL}</span><button id="wmCopy">Copy</button></div>
        </div>
      </div>`;
    document.body.appendChild(el);
    let ctx = {}, who = '', lastFocus = null;
    const readings = {
      'Recruiter': ['93% recruiter', 'I can do a call this week. Bring the JD.'],
      'Hiring manager': ['88% hiring manager', "You'll get the real numbers and the messy parts."],
      'Fellow PM': ['71% fellow PM', 'Happy to swap funnel war stories.'],
      'Just curious': ['100% curious human', 'Curiosity is the best PM trait. Say hi anyway.']
    };
    function mailto() {
      const sub = ctx.own ? `About ${ctx.caseName}` : `Walkthrough request: ${ctx.caseName}`;
      const body = `Hi Hardik,\n\nI clicked "see the real number" on ${ctx.caseName}${who ? ` (spider-sense says: ${who.toLowerCase()})` : ''}. I'd like a walkthrough of the ${ctx.metric}.\n\n`;
      return `mailto:${EMAIL}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`;
    }
    function open(data, from) {
      ctx = data; who = ''; lastFocus = from || document.activeElement;
      $('#wmCase', el).textContent = `case file · ${data.caseName}`;
      if (data.own) {
        $('#wmTitle', el).textContent = 'Plot twist: nothing to hide.';
        $('#wmCallout', el).innerHTML = '<b>Yes, that button was bait.</b> Bait buttons are a dark pattern. I shipped exactly one, for this joke, and logged it as tech debt.';
        $('#wmText', el).textContent = `${data.caseName} is my own build, so there's no NDA here. The real number is the one already on the card. Ask me how it works and I'll show you the code and the mess behind it.`;
        $('#wmCta', el).firstChild.textContent = 'Ask me how it works ';
      } else {
        $('#wmTitle', el).textContent = 'Caught in the web.';
        $('#wmCallout', el).innerHTML = '<b>Yes, that button was bait.</b> Bait buttons are a dark pattern. I shipped exactly one, for this joke, and logged it as tech debt.';
        $('#wmText', el).textContent = `The ${data.metric} behind ${data.caseName} belong to ${data.owner}. I'll walk you through them on a call, with the same respect I'd want for my own data.`;
        $('#wmCta', el).firstChild.textContent = 'Request a walkthrough ';
      }
      $('#wmPct', el).textContent = 'scanning…'; $('#wmMeter', el).style.width = '0%';
      $$('#wmWho button', el).forEach(b => b.setAttribute('aria-pressed', 'false'));
      $('#wmTag', el).textContent = "It doesn't bite. It only eats scope creep.";
      $('#wmCta', el).href = mailto();
      el.classList.add('on'); document.body.style.overflow = 'hidden';
      setTimeout(() => { $('#wmMeter', el).style.width = '62%'; $('#wmPct', el).textContent = 'pick one to calibrate'; }, 500);
      Sound.thwip(); setTimeout(Sound.suspense, 180);
      setTimeout(() => $('.wm-close', el).focus(), 50);
      document.dispatchEvent(new CustomEvent('webmodal', { detail: true }));
    }
    function close() {
      if (!el.classList.contains('on')) return;
      el.classList.remove('on'); document.body.style.overflow = '';
      Sound.stopSuspense();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      document.dispatchEvent(new CustomEvent('webmodal', { detail: false }));
    }
    el.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    $$('#wmWho button', el).forEach(b => b.addEventListener('click', () => {
      who = b.dataset.who;
      $$('#wmWho button', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const [pct, tag] = readings[who];
      $('#wmPct', el).textContent = pct; $('#wmMeter', el).style.width = parseInt(pct, 10) + '%';
      $('#wmTag', el).textContent = tag;
      $('#wmCta', el).href = mailto();
      Sound.blip(true);
    }));
    $('#wmCopy', el).addEventListener('click', () => copy(EMAIL, 'Email copied'));
    const isOpen = () => el.classList.contains('on');
    return { open, close, isOpen };
  })();

  document.addEventListener('click', e => {
    const b = e.target.closest('.bait, .redact');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    WebModal.open({
      caseName: b.dataset.case || 'this case',
      owner: b.dataset.owner || 'the company',
      metric: b.dataset.metric || 'numbers',
      own: b.dataset.own === '1'
    }, b);
  }, true);

  /* ======================================================
     HERO: Harry walks on the words
     ====================================================== */
  const stage = $('#stage');
  const tiko = $('#tiko');
  const bubble = $('#bubble');
  const bubbleText = $('#bubbleText');
  const Harry = { say() {}, sleep() {}, wake() {} };

  const hoverLines = [
    "Click me. I answer questions about Hardik.",
    "Psst. I walk on words. Hover one and watch.",
    "Careful, I'm ticklish. And under-scoped.",
    "I'm 11 pixels tall and still ship faster than most roadmaps.",
    "Event logged: harry_hovered. Funnel step 1 of 1. Conversion: you.",
    "If you're a recruiter, blink twice. I'll wait.",
    "I've walked this headline all day. My feet are mostly ink now.",
    "My PRD says I should be cute here. Am I hitting the metric?",
    "I'm a sticky note with legs. Every PM has a hundred of me.",
    "Hover again and I'll pretend it was my idea.",
    "Fun fact: I'm the only feature here that never got A/B tested."
  ];
  const wakeLines = [
    "Huh? I wasn't asleep. I was… doing discovery.",
    "Oh! I dreamt of a 100% conversion rate. It was beautiful.",
    "Sorry, the frogs were giving me roadmap feedback.",
    "I'm up! Who moved my sticky notes?"
  ];

  if (stage && tiko) {
    const words = $$('.headline .w', stage);
    const pos = { x: 0, y: 0 };
    let anim = null, patrolT = null, busy = false, hideT = null, asleep = false;
    const W = 31, H = 36;

    function spotFor(word) {
      const s = stage.getBoundingClientRect();
      const r = word.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(word).fontSize);
      const capTop = r.top + (r.height - fs) / 2 + fs * 0.2;
      const maxX = Math.max(0, r.width - W);
      const x = r.left - s.left + Math.random() * maxX;
      return { x: Math.round(x), y: Math.round(capTop - s.top - H + 4) };
    }
    function place() { tiko.style.transform = `translate(${pos.x}px, ${pos.y}px)`; placeBubble(); }
    function placeBubble() {
      if (!bubble) return;
      const bw = bubble.offsetWidth || 200, bh = bubble.offsetHeight || 60;
      const maxX = stage.clientWidth - bw;
      bubble.style.left = Math.max(0, Math.min(maxX, pos.x + 30)) + 'px';
      bubble.style.top = (pos.y - bh - 4) + 'px';
    }
    function blink() {
      if (!asleep) { tiko.classList.add('blink'); setTimeout(() => tiko.classList.remove('blink'), 140); }
      setTimeout(blink, 2400 + Math.random() * 2600);
    }
    blink();

    function moveTo(t, done) {
      cancelAnimationFrame(anim);
      const sx = pos.x, sy = pos.y, dx = t.x - sx, dy = t.y - sy;
      if (calm()) { pos.x = t.x; pos.y = t.y; place(); done && done(); return; }
      const hop = Math.abs(dy) > 8;
      const dist = Math.hypot(dx, dy);
      const dur = hop ? 520 + Math.abs(dx) * 0.6 : Math.max(250, Math.abs(dx) / 0.16);
      tiko.classList.toggle('flip', dx < 0);
      tiko.classList.add('walking');
      const t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / dur);
        pos.x = sx + dx * k;
        pos.y = sy + dy * k - (hop ? Math.sin(Math.PI * k) * (40 + Math.min(60, dist * 0.1)) : 0);
        place();
        if (k < 1) anim = requestAnimationFrame(step);
        else { tiko.classList.remove('walking'); done && done(); }
      };
      anim = requestAnimationFrame(step);
    }
    function say(text, ms = 3400) {
      if (!bubble) return;
      bubbleText.textContent = text;
      bubble.classList.add('show');
      placeBubble();
      clearTimeout(hideT);
      hideT = setTimeout(() => bubble.classList.remove('show'), ms);
    }
    function patrol() {
      clearTimeout(patrolT);
      patrolT = setTimeout(() => {
        if (!busy && !asleep && !document.hidden) moveTo(spotFor(pick(words)));
        patrol();
      }, 3800 + Math.random() * 2400);
    }
    const start = spotFor(words[1] || words[0]);
    pos.x = start.x; pos.y = start.y; place();
    setTimeout(() => say(Sound.ready() ? "Hi, I'm Harry. I walk on words." : "Hi, I'm Harry. Click anywhere to give me a voice.", 3400), 1600);
    patrol();

    words.forEach(w => {
      const go = () => {
        if (asleep) return;
        busy = true;
        moveTo(spotFor(w), () => { const opts = (w.dataset.say || '').split('|'); let l; do { l = pick(opts); } while (opts.length > 1 && l === w._last); w._last = l; say(l, 2200); setTimeout(() => (busy = false), 2500); });
      };
      w.addEventListener('mouseenter', go);
      w.addEventListener('focus', go);
    });

    // hover: creative one-liners, never the same twice in a row
    let lastLine = '';
    tiko.addEventListener('mouseenter', () => {
      if (asleep) { say('Zzz… five more minutes… then the roadmap…', 2400); return; }
      let l; do { l = pick(hoverLines); } while (l === lastLine); lastLine = l;
      say(l, 3000);
      tiko.classList.remove('wiggle'); void tiko.offsetWidth; tiko.classList.add('wiggle');
    });
    // click: open the conversation
    const poke = () => { if (window.HarryChat) window.HarryChat.open(); };
    tiko.addEventListener('click', poke);
    tiko.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } });
    window.addEventListener('resize', () => { const s = spotFor(words[1]); pos.x = s.x; pos.y = s.y; place(); });

    Harry.say = say;
    Harry.sleep = () => { asleep = true; tiko.classList.add('sleep'); bubble.classList.remove('show'); };
    Harry.wake = () => { asleep = false; tiko.classList.remove('sleep'); };

    /* ---------- name morph ---------- */
    const nameEl = $('#name');
    const chip = $('#nameChip');
    const looks = [
      { t: 'Hardik Jain', c: 'PM · funnels + AI · <i>open to roles</i>' },
      { t: 'Funnel fixer', c: 'PrepLadder · signups <i>+18%</i>' },
      { t: 'AI builder', c: 'Study Abroad Buddy · <i>0 → 10K+</i>' },
      { t: '0→1 maker', c: 'Champ 4 · <i>concept to prototype</i>' },
      { t: 'Metric owner', c: 'Lead scoring · <i>3 days → 10 min</i>' }
    ];
    let li = 0, morphing = false;
    const glyphs = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789→%+';
    function morph(next) {
      if (morphing) return; morphing = true;
      const from = nameEl.textContent, to = looks[next].t;
      const len = Math.max(from.length, to.length);
      if (calm()) { nameEl.textContent = to; chip.innerHTML = looks[next].c; li = next; morphing = false; return; }
      chip.style.opacity = 0;
      let f = 0; const frames = 16;
      const tick = () => {
        f++;
        let out = '';
        for (let i = 0; i < len; i++) {
          const done = f / frames > i / len;
          if (done) out += to[i] || '';
          else out += (from[i] === ' ' ? ' ' : glyphs[Math.floor(Math.random() * glyphs.length)]);
        }
        nameEl.textContent = out.trimEnd();
        if (f < frames) setTimeout(tick, 34);
        else { nameEl.textContent = to; chip.innerHTML = looks[next].c; chip.style.opacity = 1; li = next; morphing = false; }
      };
      tick();
    }
    nameEl.addEventListener('mouseenter', () => { Sound.pop(); morph((li + 1) % looks.length); });
    nameEl.addEventListener('click', () => { Sound.pop(); morph((li + 1) % looks.length); });
    setInterval(() => { if (!document.hidden && !busy && !asleep) morph((li + 1) % looks.length); }, 5200);
  }

  /* ======================================================
     HERO: ship-loop motion graphic (runs only while hovered)
     ====================================================== */
  const loop = $('#loop');
  if (loop) {
    const track = $('#loopTrack', loop), done = $('#loopDone', loop), ticket = $('#loopTicket', loop);
    const nodesG = $('#loopNodes', loop), steps = $('#loopSteps'), cap = $('#loopCap'), cyc = $('#loopCycle'), state = $('#loopState');
    const scenes = $$('.scene', loop);
    const N = scenes.length, STAGE = 2400, TOTAL = N * STAGE;
    const L = track.getTotalLength();
    done.style.strokeDasharray = L; done.style.strokeDashoffset = L;
    const ns = 'http://www.w3.org/2000/svg';
    const nodeEls = [], stepEls = [];
    scenes.forEach((sc, i) => {
      const p = track.getPointAtLength(L * i / N);
      const g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'lp-node');
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 9);
      const t = document.createElementNS(ns, 'text'); t.setAttribute('x', p.x); t.setAttribute('y', p.y + 0.5); t.textContent = i + 1;
      g.append(c, t); nodesG.appendChild(g); nodeEls.push(g);
      const s = document.createElement('span'); s.textContent = sc.dataset.label.toLowerCase(); steps.appendChild(s); stepEls.push(s);
    });
    let t = STAGE * 0.15, cycle = 1, cur = -1, running = false, raf = null, last = 0;
    function setStage(i) {
      if (i === cur) return;
      cur = i;
      scenes.forEach((sc, k) => {
        if (k === i) { sc.classList.remove('on'); void sc.getBoundingClientRect(); sc.classList.add('on'); }
        else sc.classList.remove('on');
      });
      nodeEls.forEach((n, k) => { n.classList.toggle('on', k === i); n.classList.toggle('done', k < i); });
      stepEls.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); });
      cap.textContent = scenes[i].dataset.cap;
    }
    function render() {
      const f = (t % TOTAL) / TOTAL;
      const p = track.getPointAtLength(L * f);
      ticket.setAttribute('transform', `translate(${p.x} ${p.y})`);
      done.style.strokeDashoffset = L * (1 - f);
      setStage(Math.floor((t % TOTAL) / STAGE));
    }
    function frame(now) {
      const dt = Math.min(64, now - last); last = now;
      const before = Math.floor(t / TOTAL);
      t += dt;
      if (Math.floor(t / TOTAL) > before) { cycle++; cyc.textContent = 'cycle ' + String(cycle).padStart(2, '0') + ' · learned ↑'; }
      render();
      if (running) raf = requestAnimationFrame(frame);
    }
    function play() {
      if (running || calm()) return;
      running = true; loop.classList.add('run');
      state.innerHTML = '<i></i>running';
      last = performance.now(); raf = requestAnimationFrame(frame);
    }
    function pause() {
      running = false; loop.classList.remove('run'); cancelAnimationFrame(raf);
      state.innerHTML = '<i></i>paused';
    }
    render();
    if (calm()) { setStage(N - 1); }
    // a short teaser so people know it moves, then it waits for a hover
    else setTimeout(() => { play(); setTimeout(() => { if (!loop.matches(':hover')) pause(); }, 1400); }, 900);
    const touch = window.matchMedia('(hover: none)').matches;
    if (!touch) {
      loop.addEventListener('mouseenter', play);
      loop.addEventListener('mouseleave', pause);
    }
    loop.addEventListener('click', () => (running ? pause() : play()));
    loop.addEventListener('focus', play);
    loop.addEventListener('blur', pause);
    $('#loopHint').textContent = touch ? 'Tap the card to run the loop. Tap again to pause.' : 'Hover the card to run the loop. Move away and it waits.';
  }

  /* ---------- flip cards: tap anywhere ---------- */
  // on phones the card is as tall as the side that is showing
  const mqPhone = window.matchMedia('(max-width: 960px)');
  function sizeCard(card) {
    const inner = $('.case-inner', card);
    if (!mqPhone.matches) { inner.style.height = ''; return; }
    const face = $(card.classList.contains('flipped') ? '.face.back' : '.face.front', card);
    face.style.minHeight = '0';
    inner.style.height = face.scrollHeight + 'px';
    face.style.minHeight = '';
  }
  const sizeAll = () => $$('.case').forEach(sizeCard);
  window.addEventListener('resize', sizeAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeAll);
  sizeAll();
  $$('.case').forEach(card => {
    new MutationObserver(() => sizeCard(card)).observe(card, { attributes: true, attributeFilter: ['class'] });
    card.addEventListener('click', e => {
      if (e.target.closest('a, .bait, .redact')) return;
      card.classList.toggle('flipped');
      Sound.blip(card.classList.contains('flipped'));
    });
    card.addEventListener('keydown', e => {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('flipped'); }
    });
  });

  /* ---------- belief 1 ---------- */
  const req = $('#req');
  if (req) {
    req.addEventListener('mouseenter', () => req.classList.add('on'));
    req.addEventListener('mouseleave', () => req.classList.remove('on'));
    req.addEventListener('click', () => req.classList.toggle('on'));
    req.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); req.classList.toggle('on'); } });
  }

  /* ---------- belief 2: evals ---------- */
  const grid = $('#evalGrid');
  if (grid) {
    const N = 100;
    const order = Array.from({ length: N }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let i = 0; i < N; i++) grid.appendChild(document.createElement('i'));
    const cells = $$('i', grid);
    const sw = $('#evalSwitch');
    function paint(on) {
      const bad = on ? 3 : 14;
      cells.forEach((c, i) => c.classList.toggle('bad', order.indexOf(i) < bad));
      $('#evalPct').textContent = bad + '%';
    }
    paint(false);
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on)); paint(on);
    });
  }

  /* ---------- belief 3: one metric ---------- */
  const cloud = $('#cloud'), cloudBtn = $('#cloudBtn');
  if (cloud) {
    let picked = false;
    cloudBtn.addEventListener('click', () => {
      picked = !picked;
      $$('span', cloud).forEach(s => {
        const star = s.textContent === 'payment success';
        s.classList.toggle('star', picked && star);
        s.classList.toggle('out', picked && !star);
      });
      cloudBtn.textContent = picked ? 'Show them all again' : 'Pick the one that matters';
    });
  }

  /* ---------- belief 4: a/b ---------- */
  const abBtn = $('#abBtn');
  if (abBtn) {
    abBtn.addEventListener('click', () => {
      const A = $('#abA'), B = $('#abB'), conf = $('#abConf');
      A.style.width = B.style.width = '0%';
      $('#abAv').textContent = $('#abBv').textContent = '0%';
      conf.innerHTML = 'collecting data…';
      let k = 0;
      const tick = () => {
        k += 1;
        const a = Math.min(31, k * 1.5), b = Math.min(36.6, k * 1.76);
        A.style.width = (a / 40 * 100) + '%'; B.style.width = (b / 40 * 100) + '%';
        $('#abAv').textContent = a.toFixed(1) + '%'; $('#abBv').textContent = b.toFixed(1) + '%';
        if (k < 21) setTimeout(tick, calm() ? 0 : 70);
        else conf.innerHTML = 'B wins · signups <b>+18%</b> · 95% confidence · ship B';
      };
      tick();
    });
  }

  /* ======================================================
     CONTACT: ship the CV, fold the email
     ====================================================== */
  const shipCv = $('#shipCv');
  if (shipCv) {
    const pipe = $$('#pipe span'), label = $('.rel-label', shipCv), foot = $('#relFoot');
    let shipping = false;
    shipCv.addEventListener('click', () => {
      if (shipping) return; shipping = true;
      shipCv.classList.remove('shipped'); shipCv.classList.add('busy');
      pipe.forEach(s => s.classList.remove('run', 'ok'));
      const msgs = ['Linting adjectives…', 'Running 300 evals on my CV…', 'Compiling 3 years into 1 page…', 'Shipping to your downloads…'];
      const per = calm() ? 0 : 480;
      pipe.forEach((s, i) => setTimeout(() => {
        if (i) { pipe[i - 1].classList.remove('run'); pipe[i - 1].classList.add('ok'); }
        s.classList.add('run'); label.textContent = msgs[i]; Sound.blip(false);
      }, i * per));
      setTimeout(() => {
        pipe[3].classList.remove('run'); pipe[3].classList.add('ok');
        const a = document.createElement('a');
        a.href = shipCv.dataset.href; a.download = 'Hardik-Jain-PM-CV.pdf';
        document.body.appendChild(a); a.click(); a.remove();
        shipCv.classList.remove('busy'); shipCv.classList.add('shipped');
        label.textContent = 'Shipped. Check your downloads';
        foot.textContent = 'deployed to: your downloads · rollback: not needed';
        Sound.blip(true); shipping = false;
        toast('CV shipped. Zero bugs reported so far.');
      }, 4 * per + 200);
    });
  }

  const mailer = $('#mailer');
  if (mailer) {
    const chips = $$('.mailer-chips button', mailer);
    chips.forEach(b => b.addEventListener('click', () => chips.forEach(x => x.setAttribute('aria-checked', String(x === b)))));
    mailer.addEventListener('submit', e => {
      e.preventDefault();
      const sub = (chips.find(b => b.getAttribute('aria-checked') === 'true') || chips[0]).dataset.sub;
      const note = $('#mailNote').value.trim();
      const body = `Hi Hardik,\n\n${note ? note + '\n\n' : ''}`;
      const href = `mailto:${mailer.dataset.email}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`;
      const go = () => { window.location.href = href; };
      if (calm()) return go();
      mailer.classList.remove('folding'); void mailer.offsetWidth; mailer.classList.add('folding');
      const plane = $('#planeFly'), r = $('.mailer-send .plane', mailer).getBoundingClientRect();
      Sound.thwip();
      plane.animate([
        { opacity: 1, transform: `translate(${r.left}px, ${r.top}px) rotate(0deg) scale(1)` },
        { opacity: 1, transform: `translate(${r.left + 80}px, ${r.top - 140}px) rotate(-20deg) scale(1.3)`, offset: 0.4 },
        { opacity: 0, transform: `translate(${window.innerWidth + 60}px, ${Math.max(-60, r.top - 420)}px) rotate(10deg) scale(.7)` }
      ], { duration: 1100, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = go;
    });
  }

  /* ======================================================
     HARRY DOCK: sticky companion, chat, tour and sleep
     ====================================================== */
  const dock = $('#dock');
  if (dock) {
    const pill = $('#dockPill'), sayEl = $('#dockSay'), ring = $('#ringVal');
    const panel = $('#panel'), log = $('#pLog'), chipsEl = $('#pChips'), form = $('#pForm'), input = $('#pInput');
    const segs = $('#pSegs'), tourTxt = $('#pTourTxt'), pTitle = $('#pTitle'), pSub = $('#pSub');
    const soundBtn = $('#soundBtn');
    const hero = $('#hero');
    let heroVisible = true, isOpen = false, sleeping = false;

    /* show the pill when hero-Harry scrolls out of view */
    const updateDock = () => dock.classList.toggle('show', !heroVisible || isOpen);
    if ('IntersectionObserver' in window && hero) {
      new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; updateDock(); }, { threshold: 0.25 }).observe(hero);
    } else { heroVisible = false; updateDock(); }

    /* scroll progress ring */
    const C = 2 * Math.PI * 14;
    ring.style.strokeDasharray = C;
    const prog = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      ring.style.strokeDashoffset = C * (1 - (h > 0 ? window.scrollY / h : 0));
    };
    window.addEventListener('scroll', prog, { passive: true }); prog();

    /* pupils follow the cursor */
    const pupils = $$('.tface .eye b');
    window.addEventListener('mousemove', e => {
      if (sleeping) return;
      pupils.forEach(p => {
        const r = p.parentElement.getBoundingClientRect();
        if (!r.width) return;
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        p.style.transform = `translate(${(dx / d) * 2.5}px, ${(dy / d) * 3.5}px)`;
      });
    }, { passive: true });
    const faces = $$('.tface');
    (function blinkLoop() {
      if (!sleeping) { faces.forEach(f => f.classList.add('blink')); setTimeout(() => faces.forEach(f => f.classList.remove('blink')), 130); }
      setTimeout(blinkLoop, 2600 + Math.random() * 3000);
    })();

    /* pill hover: creative lines */
    const pillLines = [
      "Still here. Sticky notes don't leave.",
      "Questions about Hardik? Click me.",
      "Yellow ring = how much of the page you've read.",
      "Need a tour? I do a 60-second one.",
      "I followed you down here. That's retention.",
      "Hover detected. Logging it as engagement.",
      "Ask me anything. Well, anything on this page.",
      "I'm the only sticky note that talks back."
    ];
    let sayT = null;
    function pillSay(text, ms = 3200) {
      sayEl.textContent = text; dock.classList.add('say');
      clearTimeout(sayT); sayT = setTimeout(() => dock.classList.remove('say'), ms);
    }
    pill.addEventListener('mouseenter', () => { if (!sleeping) pillSay(pick(pillLines)); else pillSay('Zzz… ribbit… zzz…'); });
    pill.addEventListener('click', () => open());

    /* sound toggle */
    const paintSound = () => { soundBtn.setAttribute('aria-pressed', String(Sound.isOn())); soundBtn.title = Sound.isOn() ? 'Sound on' : 'Sound off'; };
    soundBtn.addEventListener('click', () => { Sound.setOn(!Sound.isOn()); paintSound(); if (Sound.isOn()) Sound.blip(true); });
    paintSound();

    /* ---------- chat ---------- */
    function msg(text, who = 't') {
      const m = document.createElement('div');
      m.className = 'msg ' + who; m.innerHTML = text;
      log.appendChild(m); log.scrollTop = log.scrollHeight;
      return m;
    }
    let replyT = null;
    function reply(text, chips, delay = 650) {
      clearTimeout(replyT);
      const typing = msg('•••', 't'); typing.classList.add('typing');
      setChips([]);
      replyT = setTimeout(() => {
        typing.remove();
        msg(text, 't'); Sound.blip(false);
        setChips(chips || defaultChips);
      }, calm() ? 0 : delay);
    }
    function setChips(list) {
      chipsEl.innerHTML = '';
      list.forEach(([label, key]) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
        b.addEventListener('click', () => { msg(label, 'u'); handle(key); });
        chipsEl.appendChild(b);
      });
    }
    const defaultChips = [
      ['What does Hardik do?', 'who'], ['How much experience?', 'path'], ['What AI has he shipped?', 'ai'],
      ['Why hire him?', 'why'], ['Is he open to roles?', 'open'], ['Get his CV', 'cv']
    ];
    const answers = {
      who: ["He's a product manager who fixes funnels and ships AI products. He starts where users quit and stops when the number moves.", [['How much experience?', 'path'], ['How does he work?', 'how'], ['Why hire him?', 'why']]],
      path: ['About 3 years. Products Associate at ZIGRAM now. Before that, sole PM at PrepLadder (by Unacademy), and APM at University Living. B.Tech in ECE from LNMIIT.', [['What\'s his best work?', 'best'], ['What AI has he shipped?', 'ai'], ['Is he open to roles?', 'open']]],
      ai: ['Three LLM products with real users: Study Abroad Buddy (0 to 10K+ students), Ask Data (text-to-SQL for leadership) and PrepAI voice doubts. He writes the eval set before the prompt.', [['Tell me about evals', 'evals'], ['Tools and skills?', 'tools'], ['What\'s his best work?', 'best']]],
      evals: ['Study Abroad Buddy had a 300-question eval set. Wrong answers fell from 14% to 3% after grounding and guardrails. Rule 02 on this page lets you flip that switch yourself.', [['Take me there', 'go-how'], ['How does he work?', 'how']]],
      best: ['Start with PrepLadder: two leaks in one funnel, fixed in order of impact. Signups went up 18%. Then Study Abroad Buddy for the AI side.', [['Open PrepLadder card', 'go-funnel'], ['Why are some numbers hidden?', 'secret'], ['Why hire him?', 'why']]],
      why: ['He\'s been the sole PM on an app with 200K+ active learners, shipped three LLM products to real users, and lets A/B tests settle arguments instead of opinions.', [['What\'s his best work?', 'best'], ['Is he open to roles?', 'open'], ['Get his CV', 'cv']]],
      how: ['Four rules: fix the drop-off, not the feature request. No AI answer ships without an eval. One metric per bet. Ship small and let the test decide.', [['Take me there', 'go-rules'], ['Tools and skills?', 'tools']]],
      tools: ['GPT-4o and RAG, text-to-SQL, evals and guardrails, A/B testing, event data and session replays, CleverTap journeys, and Python, Selenium and scikit-learn for side builds.', [['What AI has he shipped?', 'ai'], ['Get his CV', 'cv']]],
      open: ["Yes. He's looking for product roles in AI, growth or B2B SaaS.", [['Where is he based?', 'based'], ['How do I reach him?', 'mail'], ['Get his CV', 'cv']]],
      based: ["India. He's open to product roles in AI, growth or B2B SaaS.", [['How do I reach him?', 'mail'], ['Get his CV', 'cv']]],
      cv: ['Hit "Ship the CV" at the bottom of the page and it lands in your downloads. Want me to take you there?', [['Take me there', 'go-cv'], ['How do I reach him?', 'mail']]],
      mail: [`Use the paper-plane form at the bottom, or write to <a href="mailto:${EMAIL}">${EMAIL}</a>. LinkedIn works too.`, [['Take me there', 'go-mail'], ['Get his CV', 'cv']]],
      jobbot: ['job-bot is his side build: it finds jobs, scores the fit, emails two recruiters per job, follows up twice, and stops the moment someone replies. 11% reply rate against about 2% cold.', null],
      hi: ['Hi! I\'m Harry. Ask me anything about Hardik.', null],
      unknown: ["I only know what's on this page, and that wasn't on it. Try one of these.", null]
    };
    const goto = (sel, then) => {
      const el = $(sel); if (!el) return;
      el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
      el.classList.add('tour-target'); setTimeout(() => el.classList.remove('tour-target'), 2200);
      then && setTimeout(then, 700);
    };
    let resumeAt = 0;
    function handle(key) {
      if (key === 'tour-resume') { startTour(resumeAt); return; }
      if (key === 'secret') { reply('Some numbers belong to the companies he worked for. He walks people through them on a call. Here\'s the vault…', null, 400); setTimeout(() => WebModal.open({ caseName: 'PrepLadder', owner: 'PrepLadder (Unacademy)', metric: 'payment and revenue numbers' }), 1800); return; }
      if (key === 'go-rules') { reply('Here are the four rules. Each card is interactive.', null); goto('#how'); return; }
      if (key === 'tour') { startTour(0); return; }
      if (key === 'go-funnel') { reply('Walking you there. Tap the card to flip it.', null); goto('#c-funnel'); return; }
      if (key === 'go-how') { reply('Rule 02, the switch on the right.', null); goto('#evalSwitch'); return; }
      if (key === 'go-cv') { reply('Here. Press the yellow button.', null); goto('#release'); return; }
      if (key === 'go-mail') { reply('Pick a subject, add a line, fold it and send.', null); goto('#mailer'); return; }
      const a = answers[key] || answers.unknown;
      reply(a[0], a[1] || defaultChips);
    }
    const intents = [
      [/\b(hi|hello|hey|yo)\b/, 'hi'],
      [/cv|resume|résumé/, 'cv'],
      [/mail|email|contact|reach|call|linkedin/, 'mail'],
      [/based|location|where.*(live|from)|india|relocat|remote/, 'based'],
      [/why.*hire|strength|stand out|good at/, 'why'],
      [/open|hiring|available|role|job(?!-?bot)|notice/, 'open'],
      [/job-?bot|bot/, 'jobbot'],
      [/eval|halluc|guardrail/, 'evals'],
      [/tool|skill|stack|tech|sql|python/, 'tools'],
      [/\bai\b|llm|gpt|rag|chatbot/, 'ai'],
      [/how.*work|process|approach|rules|principle/, 'how'],
      [/experience|years|worked|compan|background|education|zigram|prepladder|university/, 'path'],
      [/best|favou?rite|proud|case|project/, 'best'],
      [/secret|number|nda|revenue|hidden/, 'secret'],
      [/tour|guide|show me around/, 'tour'],
      [/who|about|hardik|what does/, 'who']
    ];
    form.addEventListener('submit', e => {
      e.preventDefault();
      const q = input.value.trim(); if (!q) return;
      input.value = ''; msg(q.replace(/</g, '&lt;'), 'u');
      const low = q.toLowerCase();
      const hit = intents.find(([re]) => re.test(low));
      handle(hit ? hit[1] : 'unknown');
    });

    function open(mode) {
      if (sleeping) wake();
      stopTour(true);
      isOpen = true; dock.classList.add('open'); updateDock();
      panel.classList.remove('tour'); panel.setAttribute('aria-hidden', 'false'); pill.setAttribute('aria-expanded', 'true');
      pTitle.textContent = 'Harry'; pSub.textContent = 'sticky note · knows only this page';
      if (!log.children.length) reply("Hi, I'm Harry. Ask me anything about Hardik, or tap a question below.", defaultChips, 300);
      else setChips(defaultChips);
      setTimeout(() => input.focus({ preventScroll: true }), 300);
    }
    function close() {
      stopTour(true);
      isOpen = false; dock.classList.remove('open'); updateDock();
      panel.setAttribute('aria-hidden', 'true'); pill.setAttribute('aria-expanded', 'false');
    }
    $('#pClose').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen && !WebModal.isOpen()) close(); });
    window.HarryChat = { open };

    /* ---------- tour ---------- */
    const stops = [
      ['#hero', 'Hello', "Hi, I'm Harry. I live on Hardik's headline and walk on the words. Hover any of them and I'll hop over and explain."],
      ['#loop', 'The loop', 'This is how he ships: discover, define, design, build, test, launch, measure. Hover it and it runs. Move away and it waits, like a good sprint.'],
      ['#work', 'Case files', 'Six case files. Tap anywhere on a card to flip it. Every card has the full case on both sides.'],
      ['#c-funnel', 'PrepLadder', 'Start here: two leaks in one funnel. Signups up 18%. The payment numbers are real, but they belong to the company.'],
      ['#c-funnel .bait', 'The bait', 'See that "See the real number" button? It\'s bait. Click it anyway. I dare you. Turn your sound on first.'],
      ['#archive', 'Archive', 'Nine smaller bets that didn\'t get a full write-up. Each one had an owner, a metric and a ship date.'],
      ['#how', 'Four rules', 'Four rules he works by, each from a mistake he made once. Every card is interactive, so poke them.'],
      ['#impact', 'Impact', 'The scale: 200K+ learners, 10K+ students, three AI products shipped. Black bars are NDA. Clickable NDA.'],
      ['#contact', 'Say hello', 'That\'s the tour. Ship his CV with the yellow button, or fold an email into a paper plane. He replies fast.']
    ];
    const PER = 6800;
    let ti = 0, tPlaying = false, tRaf = null, tElapsed = 0, tLast = 0, touring = false;
    stops.forEach(() => segs.appendChild(document.createElement('i')));
    const segEls = $$('i', segs);
    let typeT = null;
    function typeText(text) {
      clearInterval(typeT);
      if (calm()) { tourTxt.textContent = text; return; }
      let i = 0; tourTxt.textContent = '';
      typeT = setInterval(() => { i += 2; tourTxt.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typeT); }, 18);
    }
    function showStop(n) {
      ti = Math.max(0, Math.min(stops.length - 1, n)); tElapsed = 0;
      const [sel, name, line] = stops[ti];
      pTitle.textContent = `Stop ${ti + 1} of ${stops.length}`; pSub.textContent = name;
      segEls.forEach((s, k) => { s.classList.toggle('done', k < ti); s.classList.toggle('on', k === ti); s.style.setProperty('--p', 0); });
      typeText(line);
      $$('.tour-target').forEach(x => x.classList.remove('tour-target'));
      const el = $(sel);
      if (el) {
        el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: sel === '#hero' ? 'start' : 'center' });
        if (sel !== '#hero') el.classList.add('tour-target');
      }
      Sound.blip(true);
    }
    function tick(now) {
      if (!tPlaying) return;
      tElapsed += Math.min(64, now - tLast); tLast = now;
      const seg = segEls[ti]; if (seg) seg.style.setProperty('--p', Math.min(1, tElapsed / PER));
      if (tElapsed >= PER) { if (ti >= stops.length - 1) { endTour(); return; } showStop(ti + 1); }
      tRaf = requestAnimationFrame(tick);
    }
    function setPlaying(v) {
      tPlaying = v; $('#tPlay').textContent = v ? '❚❚' : '▶'; $('#tPlay').setAttribute('aria-label', v ? 'Pause tour' : 'Resume tour');
      cancelAnimationFrame(tRaf);
      if (v) { tLast = performance.now(); tRaf = requestAnimationFrame(tick); }
    }
    function startTour(n) {
      if (sleeping) wake();
      touring = true; isOpen = true; dock.classList.add('open'); updateDock();
      panel.classList.add('tour'); panel.setAttribute('aria-hidden', 'false');
      showStop(n || 0); setPlaying(true);
    }
    function stopTour(silent) {
      if (!touring) return;
      touring = false; setPlaying(false); clearInterval(typeT);
      panel.classList.remove('tour');
      $$('.tour-target').forEach(x => x.classList.remove('tour-target'));
      pTitle.textContent = 'Harry'; pSub.textContent = 'sticky note · knows only this page';
      if (!silent) setChips(defaultChips);
    }
    function endTour() {
      stopTour(true);
      reply("That's the tour! Anything you'd like to know about Hardik?", [['Get his CV', 'go-cv'], ['Why hire him?', 'why'], ['How do I reach him?', 'mail']], 200);
    }
    $('#tPrev').addEventListener('click', () => { showStop(ti - 1); if (!tPlaying) setPlaying(true); });
    $('#tNext').addEventListener('click', () => { if (ti >= stops.length - 1) endTour(); else showStop(ti + 1); });
    $('#tPlay').addEventListener('click', () => setPlaying(!tPlaying));
    const askMap = {
      0: [['What does Hardik do?', 'who'], ['Why hire him?', 'why']],
      1: [['Best case file?', 'best'], ['What AI has he shipped?', 'ai']],
      2: [['Best case file?', 'best'], ['Tell me about job-bot', 'jobbot']],
      3: [['Why are some numbers hidden?', 'secret'], ['Open PrepLadder card', 'go-funnel']],
      4: [['Why are some numbers hidden?', 'secret']],
      5: [['How much experience?', 'path'], ['How does he work?', 'how']],
      6: [['Tell me about evals', 'evals'], ['What does Hardik do?', 'who']],
      7: [['What AI has he shipped?', 'ai'], ['Is he open to roles?', 'open']],
      8: [['Get his CV', 'cv'], ['Email him', 'mail']]
    };
    $('#tAsk').addEventListener('click', () => {
      const n = ti, name = stops[n][1];
      stopTour(true);
      reply(`Ask me about “${name}”.`, (askMap[n] || []).concat([['Resume the tour', 'tour-resume']]), 250);
      resumeAt = n;
    });
    const tourBtn = $('#tourBtn');
    if (tourBtn) tourBtn.addEventListener('click', () => startTour(0));

    /* ---------- inactivity: Harry falls asleep to frogs and crickets ---------- */
    const IDLE_MS = 7000;
    let idleT = null;
    function sleep() {
      if (sleeping || touring || WebModal.isOpen() || document.hidden) return;
      sleeping = true;
      dock.classList.add('sleep'); panel.classList.add('sleep');
      Harry.sleep();
      if (!heroVisible && !isOpen) pillSay('Zzz…', 2000);
      Sound.nightStart();
    }
    function wake() {
      if (!sleeping) return;
      sleeping = false;
      dock.classList.remove('sleep'); panel.classList.remove('sleep');
      Harry.wake(); Sound.nightStop();
      const line = pick(wakeLines);
      if (heroVisible) Harry.say(line, 3200); else if (!isOpen) pillSay(line, 3600);
    }
    function activity() { if (sleeping) wake(); clearTimeout(idleT); idleT = setTimeout(sleep, IDLE_MS); }
    ['mousemove', 'pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, activity, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { Sound.nightStop(); } else activity(); });
    document.addEventListener('webmodal', e => { if (e.detail) { if (touring) setPlaying(false); } });
    activity();
  }

  /* ---------- nav sound button: browsers need one click before any sound ---------- */
  const soundNav = $('#soundNav');
  const paintNav = () => {
    if (!soundNav) return;
    const on = Sound.isOn();
    soundNav.classList.toggle('locked', on && !Sound.ready());
    soundNav.setAttribute('aria-pressed', String(on));
    soundNav.querySelector('.sn-l').textContent = on ? (Sound.ready() ? 'Sound on' : 'Tap for sound') : 'Sound off';
    const pb = $('#soundBtn'); if (pb) { pb.setAttribute('aria-pressed', String(on)); pb.title = on ? 'Sound on' : 'Sound off'; }
  };
  if (soundNav) {
    let wasLocked = false;
    soundNav.addEventListener('pointerdown', () => { wasLocked = !Sound.ready(); });
    soundNav.addEventListener('keydown', () => { wasLocked = !Sound.ready(); });
    soundNav.addEventListener('click', () => {
      const locked = wasLocked || !Sound.ready(); wasLocked = false;
      if (Sound.isOn() && locked) { Sound.unlock(); setTimeout(() => { Sound.pop(); paintNav(); }, 60); return; }
      Sound.setOn(!Sound.isOn()); paintNav();
      if (Sound.isOn()) setTimeout(Sound.pop, 60);
    });
    const sb = $('#soundBtn'); if (sb) sb.addEventListener('click', () => setTimeout(paintNav, 0));
    document.addEventListener('sound-ready', paintNav);
    paintNav();
  }

  /* ======================================================
     CASE PAGES: reading progress + table of contents
     ====================================================== */
  const progress = $('.progress');
  if (progress) {
    const upd = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? window.scrollY / h * 100 : 0) + '%';
    };
    window.addEventListener('scroll', upd, { passive: true }); upd();
  }
  const tocLinks = $$('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const map = new Map(tocLinks.map(a => [a.getAttribute('href').slice(1), a]));
    const io2 = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { tocLinks.forEach(a => a.classList.remove('on')); const a = map.get(e.target.id); if (a) a.classList.add('on'); }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io2.observe(s); });
  }
  void root;
})();
