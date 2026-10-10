import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the component's actual handlers; real mobile keyboard behavior needs device QA.
let slots = [], cursor = 0, pending = [], tree, input, arrow, focused = false, focusCount = 0;
const listeners = new Map();
let changed = '', selected = '', blurred = 0;
const props = {
  value: '', focusSignal: 0,
  options: [{ name: '卧推', setCount: 4, weight: 40, reps: 12, restSeconds: 90, failureType: 'set' }],
  onChange: value => { changed = value; props.value = value; },
  onSelect: preset => { selected = preset.name; props.value = preset.name; },
  onBlur: () => { blurred++; },
};
const inputNode = {
  focus() { focused = true; focusCount++; input.props.onFocus(); },
  blur() { if (focused) { focused = false; input.props.onBlur(); } },
};
const react = {
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
  },
  useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
  useEffect(callback, deps) {
    const i = cursor++;
    if (!slots[i] || deps.some((value, index) => value !== slots[i][index])) pending.push(callback);
    slots[i] = deps;
  },
};
const exports = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync('src/components/RecordView.tsx', 'utf8') + '\nexport { ExerciseCombobox };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText, {
  exports,
  require(name) {
    if (name === 'react') return react;
    if (name === 'react-dom') return { flushSync: callback => { callback(); render(); } };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === '../lib/workout') return { REST_OPTIONS: [], formatNumber: String, FAILURE_LABELS: { set: '每组力竭' } };
    return {};
  },
  document: {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  },
});
function render() {
  cursor = 0; pending = [];
  tree = exports.ExerciseCombobox(props);
  [input, arrow] = tree.props.children[0].props.children;
  input.props.ref.current = inputNode;
  tree.props.ref.current = { contains: target => target === inputNode, scrollIntoView() {} };
  pending.forEach(callback => callback());
}
function clickInput() {
  let prevented = false;
  input.props.onPointerDown({ preventDefault() { prevented = true; } });
  if (!prevented && !focused) inputNode.focus();
  input.props.onClick();
  render();
}
function clickArrow() { arrow.props.onClick(); render(); }
function outside() { listeners.get('pointerdown')({ target: {} }); render(); }
render();
assert.equal(input.props.readOnly, true);
clickInput();
assert.equal(input.props['aria-expanded'], true);
assert.equal(input.props.readOnly, true);
assert.equal(focusCount, 0, 'first input tap never focuses');
clickInput();
assert.equal(input.props.readOnly, false);
assert.equal(focused, true, 'second input tap enables typing');
input.props.onChange({ target: { value: '卧' } }); render();
assert.equal(changed, '卧');
assert.equal(tree.props.children[1].props.children.length, 1, 'typed query filters options');
outside();
assert.equal(focused, false);
assert.equal(input.props.readOnly, true);
assert.equal(input.props['aria-expanded'], false);
clickArrow();
assert.equal(focused, false, 'arrow opens without keyboard');
clickInput();
assert.equal(focused, true, 'input after arrow enables typing');
clickArrow();
assert.equal(focused, false, 'arrow dismisses editing');
assert.equal(input.props.readOnly, true);
assert.equal(input.props['aria-expanded'], false);
clickInput();
assert.equal(focused, false, 'reopening resets to selection');
tree.props.children[1].props.children[0].props.onClick(); render();
assert.equal(selected, '卧推');
assert.equal(input.props['aria-expanded'], false);
clickInput();
assert.equal(focused, false, 'selection resets first tap');
input.props.onKeyDown({ key: 'Enter', preventDefault() {} }); render();
assert.equal(focused, true);
input.props.onKeyDown({ key: 'Escape', preventDefault() {} }); render();
assert.equal(focused, false);
assert.equal(input.props['aria-expanded'], false);
props.focusSignal = 1; render(); render();
assert.equal(input.props['aria-expanded'], true);
assert.equal(input.props.readOnly, true);
assert.equal(focused, false, 'next exercise opens without keyboard');
clickInput();
assert.equal(focused, true);
assert.ok(blurred > 0, 'existing blur callback remains active');
console.log('Combobox interaction regression checks passed.');
