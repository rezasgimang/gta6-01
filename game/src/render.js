// Everything the player sees: the city from above, the cars and people in it,
// the HUD with its minimap, and the title, pause, win and busted screens.
// The camera follows Mara; the logical view is always 1280x720.
import { AVENUES, CAR, CITY, MISSIONS, PALETTE, PLAYER, ROAD_W, SEA, SPOTS, STREETS } from './config.js';
import { missionLabel, missionTarget } from './missions.js';
import { wantedStars } from './police.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_BUSTED = 'busted';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createRenderer(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');

  function camera(state) {
    const px = state.player.x;
    const py = state.player.y;
    return {
      x: Math.max(0, Math.min(CITY.width - VIEW_W, px - VIEW_W / 2)),
      y: Math.max(0, Math.min(CITY.height - VIEW_H, py - VIEW_H / 2)),
    };
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGround(cam) {
    ctx.fillStyle = '#18251c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Sea on the west and south edges, with slow wave lines.
    const seaGrad = ctx.createLinearGradient(0, 0, SEA.west, 0);
    seaGrad.addColorStop(0, PALETTE.seaDeep);
    seaGrad.addColorStop(1, PALETTE.sea);
    ctx.fillStyle = seaGrad;
    ctx.fillRect(-cam.x, -cam.y, SEA.west, CITY.height);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(-cam.x, SEA.south - cam.y, CITY.width, CITY.height - SEA.south);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    const t = performance.now() / 900;
    for (let i = 0; i < 8; i += 1) {
      const wy = ((i * 260 + t * 40) % (CITY.height - SEA.south)) + SEA.south;
      ctx.beginPath();
      ctx.moveTo(-cam.x, wy - cam.y);
      ctx.lineTo(SEA.west + 120 - cam.x, wy - cam.y);
      ctx.stroke();
    }
    // Sand between sea and city.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(SEA.west - cam.x, -cam.y, SEA.beach, CITY.height);
    ctx.fillRect(-cam.x, SEA.south - SEA.beach - cam.y, CITY.width, SEA.beach);
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, CITY.height);
    for (const sy of STREETS) ctx.fillRect(-cam.x, sy - ROAD_W / 2 - cam.y, CITY.width, ROAD_W);
    // Lane dashes down the middle of every road.
    ctx.fillStyle = PALETTE.lane;
    for (const ax of AVENUES) {
      for (let y = 40; y < CITY.height; y += 90) ctx.fillRect(ax - 3 - cam.x, y - cam.y, 6, 44);
    }
    for (const sy of STREETS) {
      for (let x = 40; x < CITY.width; x += 90) ctx.fillRect(x - cam.x, sy - 3 - cam.y, 44, 6);
    }
  }

  function drawBuildings(state, cam) {
    for (const b of state.city.buildings) {
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      if (x > VIEW_W || y > VIEW_H || x + b.w < 0 || y + b.h < 0) continue;
      ctx.fillStyle = PALETTE.building;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingTop;
      ctx.fillRect(x + 6, y + 6, b.w - 12, b.h - 12);
      // Lit windows in a fixed pattern per building so they never flicker.
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const lit = (i * 7 + j * 13 + Math.floor(b.x) + Math.floor(b.y)) % 5;
          if (lit === 0) ctx.fillStyle = PALETTE.windowLit;
          else if (lit === 1) ctx.fillStyle = PALETTE.windowNeon;
          else if (lit === 2) ctx.fillStyle = PALETTE.windowPink;
          else continue;
          ctx.fillRect(x + 12 + i * 34, y + 12 + j * 34, 16, 12);
        }
      }
    }
  }

  function drawCarShape(car, cam, time) {
    const x = car.x - cam.x;
    const y = car.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    // Wheels.
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(-16, -CAR.width / 2 - 3, 14, 6);
    ctx.fillRect(6, -CAR.width / 2 - 3, 14, 6);
    ctx.fillRect(-16, CAR.width / 2 - 3, 14, 6);
    ctx.fillRect(6, CAR.width / 2 - 3, 14, 6);
    // Body.
    ctx.fillStyle = car.police ? '#1d4ed8' : PALETTE.traffic[car.color % PALETTE.traffic.length];
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    ctx.fill();
    // Windshield and roof.
    ctx.fillStyle = 'rgba(10, 20, 30, 0.85)';
    ctx.fillRect(2, -CAR.width / 2 + 4, 12, CAR.width - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-12, -CAR.width / 2 + 4, 10, CAR.width - 8);
    if (car.police) {
      // Flashing light bar, red and blue alternating twice a second.
      const phase = Math.floor(time / 250) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2e7bff';
      ctx.fillRect(-4, -CAR.width / 2 - 2, 8, 7);
      ctx.fillStyle = phase ? '#2e7bff' : '#ff2e2e';
      ctx.fillRect(-4, CAR.width / 2 - 5, 8, 7);
    }
    if (car.skid) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-CAR.length / 2 - 14, -CAR.width / 2 + 2, 12, 5);
      ctx.fillRect(-CAR.length / 2 - 14, CAR.width / 2 - 7, 12, 5);
    }
    ctx.restore();
  }

  function drawPed(ped, cam) {
    const x = ped.x - cam.x;
    const y = ped.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    if (ped.down > 0) {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = PALETTE.ped[ped.color % PALETTE.ped.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = PALETTE.ped[ped.color % PALETTE.ped.length];
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2d5b8';
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 - 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(state, cam) {
    const player = state.player;
    if (player.inCar) return; // The car is drawn with the other cars.
    const x = player.x - cam.x;
    const y = player.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b2b33';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(player.angle) * 20, Math.sin(player.angle) * 20);
    ctx.stroke();
    if (player.punchAnim > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 30, player.angle - 0.7, player.angle + 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarker(state, cam, time) {
    const target = missionTarget(state.missions);
    if (!target) return;
    const pulse = 1 + 0.18 * Math.sin(time / 220);
    const x = target.x - cam.x;
    const y = target.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff7d6';
    ctx.font = 'bold 15px ' + 'system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(target.name, x, y - 44);
    ctx.textAlign = 'left';
  }

  function drawParticles(state, cam) {
    for (const p of state.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, (1 - a) * 46 + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function starPath(x, y, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#ffd166' : 'rgba(255,255,255,0.18)';
    ctx.fill();
  }

  function drawHud(state, time) {
    const player = state.player;
    const stars = wantedStars(state.heat);
    // Top-left: health and cash.
    ctx.fillStyle = PALETTE.panel;
    roundRect(16, 14, 260, 66, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`$${player.cash}`, 30, 40);
    ctx.fillStyle = '#3a3a4a';
    roundRect(30, 50, 200, 12, 6);
    ctx.fill();
    ctx.fillStyle = player.health > 30 ? '#4ade80' : PALETTE.danger;
    roundRect(30, 50, 200 * Math.max(0, player.health / 100), 12, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('HEALTH', 234, 41);
    // Top-right: wanted stars.
    ctx.fillStyle = PALETTE.panel;
    roundRect(VIEW_W - 236, 14, 220, 44, 10);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) starPath(VIEW_W - 216 + i * 42, 36, 14, i < stars);
    // Bottom-left: job and timer.
    ctx.fillStyle = PALETTE.panel;
    roundRect(16, VIEW_H - 84, 430, 68, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px system-ui, sans-serif';
    const job = state.missions.done ? 'JOB 3/3' : `JOB ${state.missions.index + 1}/3`;
    ctx.fillText(`${job}  ·  ${missionLabel(state.missions)}`, 30, VIEW_H - 56);
    if (state.missions.active && !state.missions.done) {
      const t = Math.max(0, state.missions.timeLeft);
      ctx.fillStyle = t < 20 ? PALETTE.danger : PALETTE.text;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`${Math.ceil(t)}s`, 30, VIEW_H - 30);
      ctx.fillStyle = '#3a3a4a';
      roundRect(80, VIEW_H - 40, 340, 9, 4);
      ctx.fill();
      ctx.fillStyle = t < 20 ? PALETTE.danger : '#ffd166';
      const total = MISSIONS[state.missions.index] ? MISSIONS[state.missions.index].time : 1;
      roundRect(80, VIEW_H - 40, 340 * Math.max(0, t / total), 9, 4);
      ctx.fill();
    }
    // Bottom-right: speed and controls.
    if (player.inCar) {
      ctx.fillStyle = PALETTE.panel;
      roundRect(VIEW_W - 236, VIEW_H - 84, 220, 68, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(`${Math.round(Math.abs(player.inCar.speed) * 0.12)} mph`, VIEW_W - 222, VIEW_H - 40);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('WASD drive · E exit', VIEW_W - 222, VIEW_H - 22);
    } else {
      ctx.fillStyle = PALETTE.panel;
      roundRect(VIEW_W - 236, VIEW_H - 84, 220, 68, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('WASD walk · E steal car', VIEW_W - 222, VIEW_H - 52);
      ctx.fillText('F punch · P pause · M mute', VIEW_W - 222, VIEW_H - 30);
    }
    // Hold-to-bust warning.
    if (state.holdTime > 0 && !player.inCar) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('THE COPS HAVE YOU — RUN!', VIEW_W / 2, 120);
      ctx.textAlign = 'left';
    }
  }

  function drawMinimap(state) {
    const mw = 190;
    const mh = 132;
    const mx = VIEW_W - mw - 16;
    const my = VIEW_H - mh - 100;
    const sx = mw / CITY.width;
    const sy = mh / CITY.height;
    ctx.fillStyle = PALETTE.panel;
    roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#0e4a5e';
    ctx.fillRect(mx, my, SEA.west * sx, mh);
    ctx.fillRect(mx, my + SEA.south * sy, mw, mh - SEA.south * sy);
    ctx.fillStyle = '#23232e';
    for (const ax of AVENUES) ctx.fillRect(mx + ax * sx - 1, my, 2, mh);
    for (const sy2 of STREETS) ctx.fillRect(mx, my + sy2 * sy - 1, mw, 2);
    for (const spot of Object.values(SPOTS)) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(mx + spot.x * sx - 2, my + spot.y * sy - 2, 4, 4);
    }
    for (const car of state.cars) {
      if (car.police) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 3, 3);
    }
    for (const cop of state.cops) {
      ctx.fillStyle = '#ff2e2e';
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const ped of state.peds) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(mx + ped.x * sx - 1, my + ped.y * sy - 1, 2, 2);
    }
    const target = missionTarget(state.missions);
    if (target) {
      const pulse = 3 + Math.sin(performance.now() / 200) * 1.5;
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2ee6ff';
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEdgeArrow(state, cam) {
    const target = missionTarget(state.missions);
    if (!target) return;
    const tx = target.x - cam.x;
    const ty = target.y - cam.y;
    if (tx > 40 && tx < VIEW_W - 40 && ty > 40 && ty < VIEW_H - 40) return;
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const ang = Math.atan2(ty - cy, tx - cx);
    const ex = cx + Math.cos(ang) * 420;
    const ey = cy + Math.sin(ang) * 240;
    const dist = Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y) / 10);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff7d6';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${target.name} ${dist}m`, ex, ey - 18);
    ctx.textAlign = 'left';
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 8, 16, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = accent;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW_W / 2, 240);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px system-ui, sans-serif';
    let y = 300;
    for (const line of lines) {
      ctx.fillText(line, VIEW_W / 2, y);
      y += 34;
    }
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best) {
    const time = performance.now();
    const cam = camera(state);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawGround(cam);
    drawBuildings(state, cam);
    drawMarker(state, cam, time);
    for (const car of state.cars) drawCarShape(car, cam, time);
    for (const ped of state.peds) drawPed(ped, cam);
    drawPlayer(state, cam);
    drawParticles(state, cam);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state, time);
      drawMinimap(state);
      drawEdgeArrow(state, cam);
    }
    if (screen === SCREEN_TITLE) {
      overlay('SOLMARA', [
        'Neon Tide courier runs — steal a car, outrun the cops, make the drops.',
        'WASD move · E steal / exit car · F punch · P pause · M mute',
        'Three jobs. Finish them all and the crew is yours.',
        '',
        'Press ENTER to start' + (state.hasSave ? '   ·   C to continue your last run' : ''),
        best > 0 ? `Best cash: $${best}` : '',
      ], '#2ee6ff');
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P to keep playing', 'Press R to restart the run'], '#ffd166');
    } else if (screen === SCREEN_WIN) {
      overlay('CREW TRUSTED', [
        `All three Neon Tide jobs done. Cash: $${state.player.cash}  ·  Best: $${best}`,
        'Mara is in. Solmara is hers now.',
        '',
        'Press R to play again',
      ], '#4ade80');
    } else if (screen === SCREEN_BUSTED) {
      overlay('BUSTED', [
        state.busted === 'wrecked' ? 'Your ride is wrecked and the cops moved in.' : 'The cops held you down and cuffed you.',
        `Cash kept: $${state.player.cash}  ·  Best: $${best}`,
        '',
        'Press R to try again',
      ], '#ff4d4d');
    }
  }

  return { draw, VIEW_W, VIEW_H };
}
