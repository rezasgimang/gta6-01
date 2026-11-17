// A tiny seeded RNG so a seed always builds the same city and the same traffic.
export function createRandom(seed) {
  let state = seed >>> 0 || 1;
  function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  }
  function range(min, max) {
    return min + next() * (max - min);
  }
  function int(min, max) {
    return Math.floor(range(min, max + 1));
  }
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }
  return { next, range, int, pick };
}
