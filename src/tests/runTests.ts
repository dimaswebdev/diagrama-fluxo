import assert from 'node:assert/strict';

import {
  buildBezierPath,
  buildOrthogonalPath,
  doesConnectionIntersectSelectionBox,
  getConnectionGeometry,
  resolveConnectionSides,
} from '@/components/diagrama/connectionRouting';
import { getCardsBounds, getCenteredViewportTransform, getFitViewportTransform } from '@/components/diagrama/viewport';
import { createHistoryManager } from '@/hooks/diagrama/historyManager';
import type { Card, DiagramState } from '@/types/diagrama';

const results: string[] = [];

const run = (name: string, fn: () => void) => {
  fn();
  results.push(`ok ${name}`);
};

const makeCard = (id: string, x: number, y: number, width = 320, height = 220): Card => ({
  id,
  x,
  y,
  width,
  height,
  sequence: 1,
  title: `Evento ${id}`,
  content: '',
  label: 'NOVO',
  date: '10/03/2026',
  source: '',
  accent: '#2563EB',
});

const makeState = (cardId: string): DiagramState => ({
  cards: [makeCard(cardId, 0, 0)],
  connections: [],
});

run('history manager performs undo and redo in order', () => {
  const history = createHistoryManager(makeState('1'));
  history.pushState(makeState('2'));
  history.pushState(makeState('3'));

  assert.equal(history.undo()?.cards[0].id, '2');
  assert.equal(history.undo()?.cards[0].id, '1');
  assert.equal(history.undo(), null);
  assert.equal(history.redo()?.cards[0].id, '2');
  assert.equal(history.redo()?.cards[0].id, '3');
});

run('history manager clears redo stack after new push', () => {
  const history = createHistoryManager(makeState('1'));
  history.pushState(makeState('2'));
  history.pushState(makeState('3'));
  history.undo();
  history.pushState(makeState('4'));

  assert.equal(history.canRedo(), false);
  assert.equal(history.getCurrent().cards[0].id, '4');
});

run('resolveConnectionSides chooses opposing sides for horizontal cards', () => {
  const result = resolveConnectionSides(makeCard('a', 0, 0), makeCard('b', 520, 10));
  assert.deepEqual(result, { fromSide: 'right', toSide: 'left' });
});

run('bezier path midpoint stays within route bounds', () => {
  const result = buildBezierPath({ x: 0, y: 0 }, { x: 300, y: 220 }, 'right', 'top');
  assert.match(result.path, /^M /);
  assert.ok(result.labelPoint.x > 40 && result.labelPoint.x < 260);
  assert.ok(result.labelPoint.y > 10 && result.labelPoint.y < 210);
});

run('orthogonal path chooses a midpoint from the dominant segment', () => {
  const result = buildOrthogonalPath({ x: 100, y: 100 }, { x: 540, y: 100 }, 'bottom', 'top');
  assert.match(result.path, /^M /);
  assert.ok(result.labelPoint.x > 250 && result.labelPoint.x < 390);
});

run('connection geometry preserves preferred source side when valid', () => {
  const geometry = getConnectionGeometry(
    makeCard('a', 0, 0),
    makeCard('b', 260, 380),
    { fromSide: 'bottom' },
    'bezier'
  );

  assert.equal(geometry.fromSide, 'bottom');
  assert.equal(geometry.startPoint.y, 220);
});

run('connection geometry preserves explicit source and target sides', () => {
  const geometry = getConnectionGeometry(
    makeCard('a', 0, 0, 320, 220),
    makeCard('b', 260, 380, 520, 220),
    { fromSide: 'right', toSide: 'top' },
    'orthogonal'
  );

  assert.equal(geometry.fromSide, 'right');
  assert.equal(geometry.toSide, 'top');
});

run('orthogonal geometry keeps explicit exits outside resized cards', () => {
  const from = makeCard('a', 520, 120, 280, 160);
  const to = makeCard('b', 200, 360, 720, 220);
  const geometry = getConnectionGeometry(
    from,
    to,
    { fromSide: 'bottom', toSide: 'top' },
    'orthogonal'
  );

  assert.equal(geometry.fromSide, 'bottom');
  assert.equal(geometry.toSide, 'top');
  assert.ok('points' in geometry);
  assert.ok(geometry.points.length >= 4);
  assert.ok(geometry.points[1].y > from.y + from.height);
  assert.ok(geometry.points[geometry.points.length - 2].y < to.y);
});

run('selection box can capture orthogonal connections', () => {
  const from = makeCard('a', 0, 0);
  const to = makeCard('b', 520, 0);
  const intersects = doesConnectionIntersectSelectionBox(
    from,
    to,
    { x: 250, y: 90, width: 80, height: 60 },
    { fromSide: 'right', toSide: 'left' },
    'orthogonal'
  );

  assert.equal(intersects, true);
});

run('selection box can capture bezier connections', () => {
  const from = makeCard('a', 0, 0);
  const to = makeCard('b', 260, 380);
  const intersects = doesConnectionIntersectSelectionBox(
    from,
    to,
    { x: 150, y: 180, width: 120, height: 100 },
    { fromSide: 'bottom', toSide: 'left' },
    'bezier'
  );

  assert.equal(intersects, true);
});

run('getCardsBounds returns the union for multiple cards', () => {
  const bounds = getCardsBounds([
    makeCard('1', 100, 120),
    makeCard('2', 700, 460, 280, 180),
  ]);

  assert.deepEqual(bounds, {
    x: 100,
    y: 120,
    width: 880,
    height: 520,
  });
});

run('single card transform centers the card in viewport', () => {
  const transform = getCenteredViewportTransform(makeCard('1', 100, 200), { width: 1200, height: 800 }, 1);
  assert.deepEqual(transform, {
    scale: 1,
    offset: { x: 340, y: 90 },
  });
});

run('fit transform scales multiple cards to fit viewport with margin', () => {
  const transform = getFitViewportTransform(
    [makeCard('1', 0, 0), makeCard('2', 900, 500), makeCard('3', 1500, 920)],
    { width: 1280, height: 720 },
    { margin: 120, minScale: 0.1, maxScale: 1 }
  );

  assert.ok(transform);
  assert.ok(transform.scale < 1);
});

console.log(results.join('\n'));
console.log(`\n${results.length} testes passaram.`);
