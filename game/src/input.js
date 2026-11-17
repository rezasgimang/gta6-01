// Keyboard input, read once per frame into a plain action object the world
// consumes. Keys are WASD or arrows to move, E to enter/exit a car, F to punch,
// P or Escape to pause, M to mute, Enter to confirm, C to continue a save.
export const ACTION = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  enter: 'enter',
  punch: 'punch',
  pause: 'pause',
  mute: 'mute',
  confirm: 'confirm',
  cont: 'cont',
  restart: 'restart',
};

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyE: 'enter',
  KeyF: 'punch',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
  Enter: 'confirm',
  KeyC: 'cont',
  KeyR: 'restart',
};

export function createInput(target) {
  const held = new Set();
  const pressed = new Set();
  function onDown(event) {
    const action = KEYMAP[event.code];
    if (!action) return;
    event.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }
  function onUp(event) {
    const action = KEYMAP[event.code];
    if (action) held.delete(action);
  }
  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);

  // Snapshot the held keys; pressed() is true once per physical key press.
  function snapshot() {
    const state = {};
    for (const action of Object.values(ACTION)) state[action] = held.has(action);
    for (const action of pressed) state[action] = true;
    pressed.clear();
    return state;
  }
  function consume(action) {
    return pressed.has(action);
  }
  return { snapshot, consume, held };
}
