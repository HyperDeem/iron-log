import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let slots = [], cursor = 0, effects = [], now = 100000;
const data = {};
const storage = {
  getItem: key => data[key] ?? null,
  setItem: (key, value) => { data[key] = value; },
  removeItem: key => { delete data[key]; },
};
const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  },
  useRef(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = { current: initial };
    return slots[index];
  },
  useEffect(callback, deps) {
    const index = cursor++;
    if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) effects.push(callback);
    slots[index] = deps;
  },
};
const jsx = (type, props) => ({ type, props });
const modules = {};
function load(path) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'lucide-react') return {};
      if (name === '../lib/draft') return modules.draft;
      if (name === '../lib/workout') return { formatDuration: value => String(value) };
      throw Error(name);
    },
    localStorage: new Proxy(storage, { ownKeys: () => Object.keys(data), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    Date: { now: () => now },
    navigator: { vibrate() {} },
    window: { setInterval() { return 1; }, clearInterval() {} },
  });
  return exports;
}
modules.draft = load('src/lib/draft.ts');
const { RestTimer } = load('src/components/RestTimer.tsx');
function render(component, props, fresh = false) {
  if (fresh) slots = [];
  cursor = 0; effects = [];
  const result = component(props);
  effects.forEach(effect => effect());
  return result;
}
const draft = () => modules.draft.useDraftState('2026-10-10', 'completedSets', 0);
let state = render(draft, {}, true);
state[1](2);
state = render(draft, {}, true);
assert.equal(state[0], 2, 'draft survives remount');
state[1](value => value + 1);
state[1](value => value + 1);
assert.equal(render(draft, {}, true)[0], 4, 'successive updates persist');
const props = { date: '2026-10-10', duration: 90, startSignal: 0, label: '组间休息' };
render(RestTimer, props, true);
render(RestTimer, { ...props, startSignal: 1 });
now += 30000;
render(RestTimer, props, true);
let timer = JSON.parse(data['iron-log:draft:v1:2026-10-10:timer']);
assert.equal(timer.endAt - now, 60000, 'remount keeps original deadline');
let tree = render(RestTimer, props);
const buttons = tree.props.children[1].props.children[2].props.children;
buttons[0].props.onClick();
timer = JSON.parse(data['iron-log:draft:v1:2026-10-10:timer']);
assert.equal(timer.endAt, null);
assert.equal(timer.remaining, 60, 'pause saves remaining seconds');
now += 10000;
render(RestTimer, props, true);
assert.equal(JSON.parse(data['iron-log:draft:v1:2026-10-10:timer']).remaining, 60, 'paused timer survives reload');
render(RestTimer, { ...props, duration: 300, label: '动作间休息', startSignal: 1 });
render(RestTimer, { ...props, startSignal: 1 });
timer = JSON.parse(data['iron-log:draft:v1:2026-10-10:timer']);
assert.equal(timer.label, '动作间休息', 'next exercise preserves active rest label');
now += 301000;
render(RestTimer, props, true);
timer = JSON.parse(data['iron-log:draft:v1:2026-10-10:timer']);
assert.equal(timer.remaining, 0, 'expired timer does not restart');
assert.equal(timer.endAt, null);
render(RestTimer, { ...props, date: '2026-10-11' }, true);
render(RestTimer, { ...props, date: '2026-10-11', duration: 300, label: '动作间休息', startSignal: 1 });
assert.equal(JSON.parse(data['iron-log:draft:v1:2026-10-11:timer']).endAt, now + 300000, 'one-set exercise starts rest when duration changes');
data['iron-log:sessions:v1'] = 'keep';
modules.draft.clearDrafts();
assert.equal(Object.keys(data).filter(key => key.startsWith('iron-log:draft:')).length, 0);
assert.equal(data['iron-log:sessions:v1'], 'keep');
console.log('Draft and timer regression checks passed.');

