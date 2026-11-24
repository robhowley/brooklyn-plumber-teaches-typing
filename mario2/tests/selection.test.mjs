import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportMovie,setupMovie,welcomeMovie,selectLesson} from '../selection.js';
const random=n=>({next:()=>n});
test('ordinary report comparisons, both two-way inversions and all equal alternatives',()=>{
  for(const [speed,previous,expected] of [[10,99,[52,51]],[8,9,[61,60]],[9,8,[54,53]],[9,9,[56,57,58,59]]])
    expected.forEach((selector,draw)=>assert.equal(reportMovie({speed,previous,threshold:10},random(draw)),selector));
});
test('supplied setup positions, welcome alternatives and unreachable final delimiter (selection vector)',()=>{
  const table=[16,17,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,42];
  table.forEach((selector,draw)=>assert.equal(setupMovie(table,random(draw)),selector));
  assert.equal(welcomeMovie(random(0)),15);assert.equal(welcomeMovie(random(1)),41);
  const lesson={bytes:[97,126,98,126,99,126],delimiter_count:3,starts:[0,1,3]};
  assert.deepEqual([0,1,2].map(n=>selectLesson(lesson,random(n)).startOffset),[0,1,3]);
});
