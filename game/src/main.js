// SOLMARA boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, win and busted screens.
//
// ?seed=N fixes the city and traffic. ?shot=start|play|chase|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createWorld, resetWorld, stepWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { clearSave, readBest, readSave, writeBest, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
const saved = readSave();
state.hasSave = !!saved;
// Debug handle for automated play-tests (read-only state inspection).
window.__solmara = state;

function announce(text) {
  status.textContent = text;
}

function applySave(data) {
  state.player.cash = data.cash;
  state.player.health = data.health;
  state.player.x = data.x;
  state.player.y = data.y;
  state.missions.index = Math.min(data.job, 2);
  state.missions.phase = 'pickup';
  state.missions.active = false;
  state.missions.timeLeft = 0;
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(window);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let sirenTimer = 0;

  function startRun(continued) {
    resetWorld(state);
    state.hasSave = !!saved;
    if (continued && saved) applySave(saved);
    screen = SCREEN_PLAY;
    announce('SOLMARA: steal a car, run the Neon Tide jobs, outrun the cops.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const keys = input.snapshot();
    if (keys.mute && !frame.muteLatch) {
      frame.muteLatch = true;
      audio.setMuted(!audio.isMuted());
    }
    if (!keys.mute) frame.muteLatch = false;

    if (screen === SCREEN_TITLE) {
      if (keys.confirm) {
        audio.unlock();
        startRun(false);
      } else if (keys.cont && saved) {
        audio.unlock();
        startRun(true);
      }
    } else if (screen === SCREEN_PLAY) {
      if (keys.pause) {
        screen = SCREEN_PAUSED;
        audio.stopEngine();
      } else {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          stepWorld(state, keys, STEP);
          accumulator -= STEP;
        }
        // Sound follows the run: engine hum, sirens when wanted.
        const ratio = state.player.inCar ? Math.abs(state.player.inCar.speed) / 540 : 0;
        audio.engine(ratio);
        sirenTimer -= elapsed;
        if (state.stars > 0 && sirenTimer <= 0) {
          audio.siren(true);
          sirenTimer = 1.4;
        }
        // Drain the event queue into sounds.
        for (const event of state.events) {
          if (event.type === 'punch') audio.punch();
          else if (event.type === 'pickup') audio.pickup();
          else if (event.type === 'paid') audio.paid();
          else if (event.type === 'ram') audio.crash();
        }
        // Autosave every few seconds while playing.
        saveTimer += elapsed;
        if (saveTimer > 5) {
          saveTimer = 0;
          writeSave(state);
        }
        if (state.won) {
          writeBest(Math.max(best, state.player.cash));
          best = Math.max(best, state.player.cash);
          clearSave();
          audio.win();
          audio.stopEngine();
          screen = SCREEN_WIN;
        } else if (state.busted) {
          writeBest(Math.max(best, state.player.cash));
          best = Math.max(best, state.player.cash);
          audio.busted();
          audio.stopEngine();
          screen = SCREEN_BUSTED;
        } else if (state.player.health <= 0) {
          state.busted = 'wrecked';
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (keys.pause) screen = SCREEN_PLAY;
      else if (keys.confirm) {
        writeSave(state);
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_WIN || screen === SCREEN_BUSTED) {
      if (keys.confirm) {
        audio.unlock();
        startRun(false);
      }
    }
    // R restarts from win, busted or pause.
    if ((screen === SCREEN_WIN || screen === SCREEN_BUSTED || screen === SCREEN_PAUSED) && keys.restart) {
      audio.unlock();
      startRun(false);
    }
    state.screen = screen;
    renderer.draw(state, screen, best);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
