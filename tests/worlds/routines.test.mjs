import test from 'node:test';
import assert from 'node:assert/strict';
import { i16, durationSeconds, waterCharacter, practiceCharacter, practiceExpression, castleFailure, waterSwimmer, waterBubble, castleApproach, castleRockface, castleSand, castleTextTarget, waterPursuer, practiceCorpus } from '../../recovered/worlds/routines.mjs';
const stats = { attempts: 0, correct: 0, errors: 0 };
test('word multiplication truncates before sign extension', () => {
  assert.equal(durationSeconds(0, 300), 300);
  assert.equal(durationSeconds(0, 600), 600);
  assert.equal(durationSeconds(10, 300), 600);
  assert.equal(durationSeconds(547, 300), -32716);
  assert.equal(i16(65535), -1);
});
test('water compares exact case and counts DEL but not CR or extended keys', () => {
  assert.equal(waterCharacter(stats, 65, 97).result, 'retain-target');
  assert.equal(waterCharacter(stats, 97, 97).result, 'advance-one-byte');
  assert.equal(waterCharacter(stats, 127, 127).correct, 1);
  for (const key of [0, 13, 31, 128, 301]) assert.equal(waterCharacter(stats, key, key).result, 'ignored');
  assert.equal(waterCharacter({ ...stats, attempts: 32767 }, 32, 32).attempts, -32768);
});
test('practice corpus follows goal thresholds despite activity mode4', () => {
  assert.equal(practiceCorpus(9), 'letters');
  assert.equal(practiceCorpus(10), 'words');
  assert.equal(practiceCorpus(29), 'words');
  assert.equal(practiceCorpus(30), 'sentenc');
});
test('pursuer frame resources and wrap-driven mode change', () => {
  const s = { mode:1, frame:0, x:0, drawnX:0, failed:false, failurePhase:0 };
  const n = waterPursuer(s, { x:20,y:112 });
  assert.deepEqual([n.gap,n.x,n.y,n.drawnX,n.resourceIndex], [24,-52,107,-54,18]);
  const wrap = waterPursuer({ ...s, drawnX:300 }, { x:100,y:112 });
  assert.equal(wrap.mode, 2); assert.equal(wrap.resourceIndex,18);
  const octo = waterPursuer({ ...s, mode:2,frame:19 }, { x:20,y:112 });
  assert.equal(octo.frame,0); assert.equal(octo.y,108); assert.equal(octo.resourceIndex,23);
  const fail = waterPursuer({ ...s, failed:true, failurePhase:1, drawnX:0, savedY:112 }, { x:38,y:112 });
  assert.equal(fail.failurePhase,2); assert.equal(fail.x,3);
});
test('practice line ending is space or CR, not LF; errors do not reset expression timer', () => {
  for (const key of [32, 13]) assert.equal(practiceCharacter(stats, key, 0).result, 'next-line');
  assert.equal(practiceCharacter(stats, 10, 0).result, 'ignored');
  assert.equal(practiceCharacter(stats, 13, 65).errors, 1);
  assert.equal(practiceCharacter(stats, 97, 65).resetLastCorrectTime, false);
  assert.equal(practiceCharacter(stats, 65, 65).resetLastCorrectTime, true);
});
test('practice expressions use strict >15 idle and strict >goal success', () => {
  assert.equal(practiceExpression(15, 0, true, 11, 10), 2);
  assert.equal(practiceExpression(16, 0, true, 11, 10), 0);
  assert.equal(practiceExpression(15, 0, true, 10, 10), 1);
  assert.equal(practiceExpression(15, 0, false, 11, 10), 1);
});
test('castle failure gates and exact thresholds', () => {
  const s = { operation: 2, failed: false, attempts: 50, accuracy: 69, now: 20, lastInput: 0 };
  assert.equal(castleFailure(s), true);
  assert.equal(castleFailure({ ...s, attempts: 49 }), false);
  assert.equal(castleFailure({ ...s, accuracy: 70 }), false);
  assert.equal(castleFailure({ ...s, accuracy: 70, now: 21 }), true);
  assert.equal(castleFailure({ ...s, operation: 3 }), false);
  assert.equal(castleFailure({ ...s, failed: true, operation: 3 }), true);
});
test('water follows peak-relative WPM, moves one vertical pixel, wraps x and cycles six frames', () => {
  const s = { peak: 0, x: 319, y: 112, counter: 1, frame: 5, delay: 0, failed: false, ended: false };
  const n = waterSwimmer(s, 10);
  assert.deepEqual([n.peak,n.target,n.x,n.y,n.frame,n.delay], [10,94,-55,111,0,1]);
  const slow = waterSwimmer({ ...s, peak: 20 }, 10);
  assert.equal(slow.target, 126); assert.equal(slow.y, 113);
  const fail = waterSwimmer({ ...s, failed: true, failurePhase: 2, y: 199 }, 10);
  assert.equal(fail.ended, true); assert.equal(fail.y, 200); assert.equal(fail.x, 319);
});
test('water bubbles divide toward zero, enlarge after dy reaches -11, use inclusive bounds', () => {
  const s = { active: true, x: 317, y: 80, dx: 0, dy: -7, large: false };
  assert.deepEqual(waterBubble(s), { ...s, y: 79, dy: -8 });
  assert.equal(waterBubble({ ...s, dy: -10 }).large, true);
  assert.equal(waterBubble({ ...s, dx: 1 }).active, false);
  assert.equal(waterBubble({ ...s, y: 79 }).active, false);
});
test('castle approach accelerates and retains original asymmetric +1', () => {
  assert.deepEqual(castleApproach(0, 0, 20), { x: 1, velocity: 1, desired: 5 });
  assert.deepEqual(castleApproach(20, 5, 20), { x: 20, velocity: 0, desired: 0 });
  assert.deepEqual(castleApproach(21, 0, 20), { x: 22, velocity: 1, desired: 1 });
  let s = { x: 0, velocity: 0 };
  for (let i=0; i<40; i++) s = castleApproach(s.x, s.velocity, 120);
  assert.equal(s.x, 120); assert.equal(s.velocity, 0);
});
test('rockface starts at x equality, follows 32 samples then remains at state100', () => {
  let s = { x: 53, y: 40, phase: 0, resourceIndex: 0 };
  assert.equal(castleRockface(s, 52).phase, 0);
  s = castleRockface(s, 53);
  assert.deepEqual([s.phase,s.y,s.resourceIndex,s.triggered], [2,40,1,true]);
  for (let i=0;i<31;i++) s=castleRockface(s,53);
  assert.equal(s.phase,100); assert.equal(s.y,101); assert.equal(s.resourceIndex,0);
  assert.equal(castleRockface(s,0).phase,100);
});
test('sand depth and text progress are integer formulas, not collision or death checks', () => {
  assert.deepEqual(castleSand(67,100,0), { x:68,y:80 });
  assert.deepEqual(castleSand(100,90,39), { x:100,y:70 });
  assert.deepEqual(castleSand(100,100,40), { x:100,y:70 });
  assert.equal(castleTextTarget(3,10,0),115);
  assert.equal(castleTextTarget(0,0,70),70);
  assert.equal(castleTextTarget(205,300,0),-42);
});
