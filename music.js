/* Wedding music engine: original compositions synthesised in the browser with Web Audio. */
(function () {
  "use strict";
  var STYLES = ["track", "flute", "veena", "duet", "shehnai", "nadaswaram", "santoor"];

  /* Recorded track (royalty-free, Pixabay) played through an <audio> element, which also plays in iPhone silent mode */
  function createTrack() {
    var audio = new Audio("wedding-music.m4a"), fade;
    audio.loop = true; audio.preload = "auto"; audio.setAttribute("playsinline", "");
    var playing = false;
    function ramp(to, ms, done) {
      clearInterval(fade);
      var from = audio.volume, steps = Math.max(1, Math.round(ms / 50)), i = 0;
      fade = setInterval(function () {
        i++;
        try { audio.volume = Math.min(1, Math.max(0, from + (to - from) * i / steps)); } catch (e) {}
        if (i >= steps) { clearInterval(fade); if (done) done(); }
      }, 50);
    }
    return {
      style: "track",
      start: function () {
        playing = true;
        try { audio.volume = 0; } catch (e) {}
        var p = audio.play();
        if (p && p.catch) p.catch(function () { playing = false; });
        ramp(.9, 2500);
        return true;
      },
      stop: function () { playing = false; ramp(0, 400, function () { audio.pause(); }); },
      destroy: function () { playing = false; clearInterval(fade); audio.pause(); },
      playing: function () { return playing; }
    };
  }

  function create(STYLE) {
    if (STYLE === "track") return createTrack();
    if (STYLES.indexOf(STYLE) < 0) STYLE = "flute";
    var SA = 293.66; // D4
    function hz(semi) { return SA * Math.pow(2, semi / 12); }
    var ctx, master, wet, timer, engine, noise;

    function impulse(seconds, decay) {
      var len = ctx.sampleRate * seconds, buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = buf.getChannelData(c);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }
    function route(node, sendAmt) {
      node.connect(master);
      var s = ctx.createGain(); s.gain.value = sendAmt; node.connect(s); s.connect(wet);
    }
    function noiseSrc() {
      var s = ctx.createBufferSource(); s.buffer = noise; return s;
    }

    /* ---------- Instruments ---------- */
    function tanpura(freq, t, vol) {
      var g = ctx.createGain(), bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.Q.value = 3;
      bp.frequency.setValueAtTime(2800, t);
      bp.frequency.exponentialRampToValueAtTime(500, t + 3);
      [-4, 4].forEach(function (cents) {
        var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = freq; o.detune.value = cents;
        o.connect(bp); o.start(t); o.stop(t + 4.6);
      });
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
      var body = ctx.createOscillator(); body.type = "triangle"; body.frequency.value = freq;
      body.connect(lp); lp.connect(g); body.start(t); body.stop(t + 4.6);
      bp.connect(g);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + .04);
      g.gain.exponentialRampToValueAtTime(.0006, t + 4.5);
      route(g, .6);
    }
    function tanpuraLoop(beatLen, vol) {
      var strings = [hz(-5) / 2, hz(0) / 2, hz(0) / 2, hz(-12) / 2], step = 0, next = 0;
      return {
        reset: function (t) { next = t; },
        schedule: function (h) { while (next < h) { tanpura(strings[step++ % 4], next, vol); next += beatLen; } }
      };
    }
    function bell(t) {
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.05, t + .005);
      g.gain.exponentialRampToValueAtTime(.0005, t + 3.5);
      [[1, 1], [2.76, .45], [5.4, .2], [8.9, .08]].forEach(function (p) {
        var o = ctx.createOscillator(), pg = ctx.createGain();
        o.frequency.value = hz(24) * p[0]; pg.gain.value = p[1];
        o.connect(pg); pg.connect(g); o.start(t); o.stop(t + 3.6);
      });
      route(g, .8);
    }
    function veenaPluck(freq, t, dur, vol, glide) {
      var out = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(freq * 7, t);
      lp.frequency.exponentialRampToValueAtTime(freq * 1.8, t + Math.max(dur, .3));
      [["triangle", 1, 1], ["sine", 2, .35], ["sine", 3, .12]].forEach(function (h) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = h[0];
        var f = freq * h[1];
        if (glide) {
          o.frequency.setValueAtTime(f / Math.pow(2, 1 / 12), t);
          o.frequency.linearRampToValueAtTime(f, t + .16);
        } else o.frequency.setValueAtTime(f, t);
        g.gain.value = h[2];
        o.connect(g); g.connect(lp);
        o.start(t); o.stop(t + dur + 2);
      });
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(vol, t + .012);
      out.gain.exponentialRampToValueAtTime(.0008, t + dur + 1.9);
      lp.connect(out); route(out, .55);
    }
    function santoorStrike(freq, t, vol) {
      var g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 6500;
      [-6, 6].forEach(function (cents) {
        [[1, 1], [2, .4], [3, .16], [4.1, .07]].forEach(function (p) {
          var o = ctx.createOscillator(), pg = ctx.createGain();
          o.frequency.value = freq * p[0]; o.detune.value = cents; pg.gain.value = p[1] * .5;
          o.connect(pg); pg.connect(lp); o.start(t); o.stop(t + 1.6);
        });
      });
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + .003);
      g.gain.exponentialRampToValueAtTime(.0008, t + 1.5);
      lp.connect(g); route(g, .5);
    }
    function tabla(stroke, t, vol) {
      function bayan(v) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(70, t + .35);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.exponentialRampToValueAtTime(.001, t + .5);
        o.connect(g); o.start(t); o.stop(t + .55); route(g, .2);
      }
      function dayan(v, ring) {
        var g = ctx.createGain();
        [[1, 1], [2.02, .35], [3.01, .15]].forEach(function (p) {
          var o = ctx.createOscillator(), pg = ctx.createGain();
          o.frequency.value = hz(0) * p[0]; pg.gain.value = p[1];
          o.connect(pg); pg.connect(g); o.start(t); o.stop(t + ring + .05);
        });
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .003); g.gain.exponentialRampToValueAtTime(.001, t + ring);
        route(g, .25);
      }
      function slap(v) {
        var s = noiseSrc(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 1;
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
        s.connect(bp); bp.connect(g); s.start(t, Math.random()); s.stop(t + .08); route(g, .1);
      }
      if (stroke === "Dha") { bayan(vol); dayan(vol * .6, .6); }
      else if (stroke === "Dhi") { bayan(vol * .8); dayan(vol * .45, .3); }
      else if (stroke === "Ge") bayan(vol * .9);
      else if (stroke === "Na") dayan(vol * .55, .5);
      else if (stroke === "Ti") dayan(vol * .4, .12);
      else if (stroke === "Ka") slap(vol * .5);
    }
    /* A sustained gliding voice: flute, shehnai or nadaswaram */
    function legatoVoice(kind) {
      var v = { gain: ctx.createGain(), vib: ctx.createGain(), oscs: [] };
      v.gain.gain.value = 0;
      var lfo = ctx.createOscillator(); lfo.frequency.value = { flute: 4.6, shehnai: 5, nadaswaram: 5.6 }[kind];
      v.vib.gain.value = 0; lfo.connect(v.vib); lfo.start();
      var input;
      function addOsc(h) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = h[0]; o.frequency.value = SA * h[1]; g.gain.value = h[2];
        v.vib.connect(o.detune); o.connect(g); g.connect(input); o.start();
        v.oscs.push({ osc: o, ratio: h[1] });
      }
      if (kind === "flute") {
        var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
        lp.connect(v.gain); input = lp;
        [["sine", 1, .8], ["triangle", 2, .07], ["sine", 3, .03]].forEach(addOsc);
        var n = noiseSrc(); n.loop = true;
        var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = .8;
        var ng = ctx.createGain(); ng.gain.value = .05;
        n.connect(bp); bp.connect(ng); ng.connect(v.gain); n.start();
      } else {
        var shehnai = kind === "shehnai";
        var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = shehnai ? 300 : 250;
        var f1 = ctx.createBiquadFilter(); f1.type = "peaking"; f1.frequency.value = shehnai ? 1350 : 1150; f1.Q.value = shehnai ? 1 : 1.4; f1.gain.value = shehnai ? 7 : 9;
        var f2 = ctx.createBiquadFilter(); f2.type = "peaking"; f2.frequency.value = 2600; f2.Q.value = 2; f2.gain.value = shehnai ? 3 : 6;
        var lp2 = ctx.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = shehnai ? 3000 : 4200;
        hp.connect(f1); f1.connect(f2); f2.connect(lp2); lp2.connect(v.gain); input = hp;
        (shehnai ? [["sawtooth", 1, .45], ["triangle", 1.002, .35]] : [["sawtooth", 1, .55], ["square", 1.003, .3]]).forEach(addOsc);
      }
      route(v.gain, kind === "nadaswaram" ? .35 : .6);
      v.play = function (semi, t, len, vol, vibDepth, glideTc) {
        if (semi === null) { v.gain.gain.setTargetAtTime(0, t, .12); return; }
        var f = hz(semi);
        v.oscs.forEach(function (o) { o.osc.frequency.setTargetAtTime(f * o.ratio, t, glideTc); });
        v.gain.gain.setTargetAtTime(vol * .6, t, .015);
        v.gain.gain.setTargetAtTime(vol, t + .06, .08);
        v.vib.gain.cancelScheduledValues(t);
        v.vib.gain.setValueAtTime(0, t);
        if (len > 1.2) v.vib.gain.linearRampToValueAtTime(vibDepth, t + len * .9);
      };
      return v;
    }

    /* Generic sequencer: song = [[semi|null, beats], ...] */
    function sequence(song, beat, onNote) {
      var i = 0, next = 0, beats = 0;
      return {
        reset: function (t) { next = t; },
        schedule: function (h) {
          while (next < h) {
            var n = song[i++ % song.length], len = n[1] * beat;
            onNote(n, next, len, beats);
            next += len; beats += n[1];
          }
        }
      };
    }
    function combine(parts) {
      return {
        reset: function (t) { parts.forEach(function (p) { p.reset(t); }); },
        schedule: function (h) { parts.forEach(function (p) { p.schedule(h); }); }
      };
    }

    /* ---------- Compositions ---------- */
    var ENGINES = {
      /* 1. Bansuri in raga Kalyani (S R2 G3 M2 P D2 N3), tanpura and temple bell */
      flute: function () {
        var beat = 60 / 56, voice = legatoVoice("flute");
        var song = [
          [7,2],[9,1],[11,1],[12,3],[null,1], [11,1],[9,1],[7,1],[6,1],[4,3],[null,1],
          [4,1],[6,1],[7,2],[9,1],[7,1],[6,1],[4,1], [2,1],[4,1],[2,1],[0,4],[null,1],
          [12,2],[14,1],[16,1],[14,2],[12,1],[11,1], [9,1],[11,1],[9,1],[7,1],[6,1],[7,3],
          [9,2],[7,1],[6,1],[4,2],[2,1],[4,1], [2,1],[0,1],[-1,1],[0,4],[null,1]
        ];
        return combine([
          sequence(song, beat, function (n, t, len, b) { if (b % 16 === 0) bell(t); voice.play(n[0], t, len, .17, 14, .07); }),
          tanpuraLoop(beat * 1.1, .045)
        ]);
      },
      /* 2. Veena in raga Mohanam (S R2 G3 P D2), tanpura */
      veena: function () {
        var beat = 1;
        var song = [
          [4,1],[7,1],[9,1],[12,2],[9,.5],[7,.5],[4,1],[2,1],[4,2],[null,2],
          [7,1],[9,1],[12,1],[14,1],[16,2],[14,1],[12,1],[9,2],[7,2],[null,2],
          [12,1],[9,.5],[7,.5],[4,1],[7,1],[9,2],[7,1],[4,1],[2,2],[0,1],[2,1],[4,2],[null,2],
          [0,1],[-3,1],[0,1],[2,1],[4,2],[2,1],[0,1],[-3,2],[0,3],[null,3]
        ];
        return combine([
          sequence(song, beat, function (n, t, len) { if (n[0] !== null) veenaPluck(hz(n[0]), t, len, .16, n[1] >= 2); }),
          tanpuraLoop(beat * 1.2, .04)
        ]);
      },
      /* 3. Flute and veena in conversation, raga Hamsadhwani (S R2 G3 P N3) */
      duet: function () {
        var beat = 1, voice = legatoVoice("flute");
        var phrases = [
          ["f", [[7,1],[11,1],[12,2],[14,1],[12,1],[11,2]]], ["v", [[12,.5],[11,.5],[7,1],[4,2]]],
          ["f", [[4,1],[7,1],[11,1],[12,1],[14,2],[12,2]]], ["v", [[14,.5],[12,.5],[11,1],[7,2]]],
          ["f", [[16,2],[14,1],[12,1],[11,1],[12,1],[14,2]]], ["v", [[12,.5],[14,.5],[12,1],[11,2]]],
          ["f", [[7,1],[4,1],[2,1],[4,1],[0,4]]], ["v", [[7,.5],[4,.5],[2,1],[0,2]]]
        ];
        var song = [];
        phrases.forEach(function (p) { p[1].forEach(function (n) { song.push([n[0], n[1], p[0]]); }); });
        return combine([
          sequence(song, beat, function (n, t, len, b) {
            if (b % 24 === 0) bell(t);
            if (n[2] === "f") voice.play(n[0], t, len, .15, 14, .06);
            else { voice.play(null, t, len); veenaPluck(hz(n[0] - 12), t, len, .2, n[1] >= 2); }
          }),
          tanpuraLoop(beat * 1.15, .04)
        ]);
      },
      /* 4. Shehnai in raga Yaman Kalyan, slow, with tanpura */
      shehnai: function () {
        var beat = 60 / 52, voice = legatoVoice("shehnai");
        var song = [
          [-1,1],[2,1],[4,2],[6,1],[4,1],[2,2],
          [4,1],[6,1],[7,2],[9,1],[7,1],[6,1],[4,1],
          [7,1],[9,1],[11,1],[12,3],[null,2],
          [12,1],[11,1],[9,1],[7,1],[6,1],[4,1],[2,2],
          [4,1],[2,1],[-1,1],[2,1],[0,3],[null,1]
        ];
        return combine([
          sequence(song, beat, function (n, t, len) { voice.play(n[0], t, len, .13, 20, .06); }),
          tanpuraLoop(beat * 1.1, .045)
        ]);
      },
      /* 5. Mangala vadyam: nadaswaram in raga Hamsadhwani with thavil and ottu drone */
      nadaswaram: function () {
        var beat = 60 / 84, voice = legatoVoice("nadaswaram");
        var song = [
          [12,1.5],[11,.5],[12,1],[14,1],[16,2],[14,1],[12,1],
          [11,1],[12,.5],[11,.5],[7,1],[4,1],[2,1],[4,1],[7,2],
          [4,1],[7,1],[11,1],[12,1],[11,.5],[12,.5],[14,1],[12,2],
          [11,1],[7,1],[4,1],[2,1],[0,3],[null,1],
          [12,1],[14,1],[16,1],[19,1],[16,2],[14,1],[12,1],
          [14,.5],[16,.5],[14,1],[12,1],[11,1],[12,2],[11,1],[7,1],
          [4,1],[7,1],[11,1],[12,1],[11,.5],[12,.5],[14,1],[12,2],
          [11,1],[7,1],[4,1],[2,1],[0,3],[null,1]
        ];
        var ottu = ctx.createGain(); ottu.gain.value = .022;
        var olp = ctx.createBiquadFilter(); olp.type = "lowpass"; olp.frequency.value = 900;
        [hz(-12), hz(-5)].forEach(function (f, k) {
          var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = k ? 3 : -3;
          o.connect(olp); o.start();
        });
        olp.connect(ottu); route(ottu, .4);
        var thavil = "D.ttT.tDD.ttTtTt".split("").map(function (k) { return [k, .5]; });
        return combine([
          sequence(song, beat, function (n, t, len) { voice.play(n[0], t, len, .11, 22, .035); }),
          sequence(thavil, beat, function (n, t) {
            var k = n[0]; if (k === ".") return;
            var g = ctx.createGain();
            if (k === "t") {
              var s = noiseSrc(), bp = ctx.createBiquadFilter();
              bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 1.2;
              g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .07);
              s.connect(bp); bp.connect(g); s.start(t, Math.random()); s.stop(t + .09);
            } else {
              var o = ctx.createOscillator(), lo = k === "D";
              o.frequency.setValueAtTime(lo ? 120 : 260, t);
              o.frequency.exponentialRampToValueAtTime(lo ? 58 : 200, t + (lo ? .3 : .12));
              g.gain.setValueAtTime(0, t);
              g.gain.linearRampToValueAtTime(lo ? .5 : .28, t + .005);
              g.gain.exponentialRampToValueAtTime(.001, t + (lo ? .45 : .2));
              o.connect(g); o.start(t); o.stop(t + .5);
            }
            route(g, .15);
          })
        ]);
      },
      /* 6. Santoor in raga Bhupali (S R2 G3 P D2) with soft tabla in keherwa */
      santoor: function () {
        var beat = 60 / 70;
        var song = [
          [0,1],[2,1],[4,1],[7,1],[9,2],[7,2],
          [9,1],[12,1],[9,1],[7,1],[4,2],[2,2],
          [4,1],[7,1],[9,1],[12,1],[14,2],[12,2],
          [9,1],[7,1],[4,1],[2,1],[0,3],[null,1]
        ];
        var keherwa = ["Dha","Ge","Na","Ti","Na","Ka","Dhi","Na"].map(function (s) { return [s, 1]; });
        return combine([
          sequence(song, beat, function (n, t, len) {
            if (n[0] === null) return;
            var f = hz(n[0]);
            if (n[1] >= 2) {
              for (var k = 0, tt = t; tt < t + len - .1; k++, tt += .11) santoorStrike(f, tt, .09 * Math.pow(.93, k) + .03);
            } else {
              santoorStrike(f, t, .13);
            }
          }),
          sequence(keherwa, beat, function (n, t) { tabla(n[0], t, .16); }),
          tanpuraLoop(beat * 1.2, .03)
        ]);
      }
    };

    function start() {
      if (!ctx) {
        try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        var nd = noise.getChannelData(0);
        for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        master = ctx.createGain(); master.gain.value = 0;
        var comp = ctx.createDynamicsCompressor();
        master.connect(comp); comp.connect(ctx.destination);
        var loud = STYLE === "nadaswaram";
        var rev = ctx.createConvolver(); rev.buffer = impulse(loud ? 2.4 : 4, 3);
        wet = ctx.createGain(); wet.gain.value = loud ? .45 : .6;
        wet.connect(rev); rev.connect(master);
        engine = ENGINES[STYLE]();
        engine.reset(ctx.currentTime + .2);
      }
      if (ctx.state === "suspended") ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(.85, ctx.currentTime, .9);
      if (!timer) {
        timer = setInterval(function () { engine.schedule(ctx.currentTime + .35); }, 100);
        engine.schedule(ctx.currentTime + .35);
      }
      return true;
    }
    function stop() {
      if (!ctx) return;
      clearInterval(timer); timer = null;
      master.gain.setTargetAtTime(0, ctx.currentTime, .15);
      setTimeout(function () {
        if (!timer) ctx.suspend().then(function () { engine.reset(ctx.currentTime + .2); });
      }, 600);
    }
    function destroy() {
      clearInterval(timer); timer = null;
      if (ctx) { var c = ctx; ctx = null; master.gain.setTargetAtTime(0, c.currentTime, .08); setTimeout(function () { c.close(); }, 300); }
    }
    return { start: start, stop: stop, destroy: destroy, playing: function () { return !!timer; }, style: STYLE };
  }

  window.WeddingMusic = { create: create, styles: STYLES };
})();
