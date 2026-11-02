const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function mount(file, name, props, reducedMotion = false) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `Missing ${name}`);
  const compiled = ts.transpileModule('export ' + declaration.getText(source), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const slots = [], effects = [], intervals = [], cleanups = [];
  const activeIntervals = new Map();
  const frames = new Map(), listeners = new Map();
  let frameId = 0, time = 0;
  const document = { hidden: false };
  let cursor = 0;
  function effect(callback, dependencies) {
    const index = cursor++;
    const previous = slots[index];
    if (previous && dependencies && previous.length === dependencies.length && dependencies.every((value, i) => Object.is(value, previous[i]))) return;
    effects.push(() => {
      cleanups[index]?.();
      slots[index] = dependencies;
      cleanups[index] = callback();
    });
  }
  const hooks = {
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(value) { const index = cursor++; return slots[index] ||= { current: value }; },
    useMemo: callback => callback(),
    useId: () => 'team-details',
    useEffect: effect,
    useLayoutEffect: effect,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    ...hooks, exports, require, document, Image: 'img', ChevronLeft: 'left-icon', ChevronRight: 'right-icon',
    ArrowLeft: 'left-icon', ArrowRight: 'right-icon', TeamCarouselCard: 'team-card', ProfilePlaceholder: 'placeholder',
    splitTourCategoryLabels: () => [], getImageStyle: () => ({}), cn: (...classes) => classes.filter(Boolean).join(' '),
    window: {
      matchMedia: () => ({ matches: reducedMotion }),
      addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
      removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
      requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
      cancelAnimationFrame(id) { frames.delete(id); },
      setInterval: callback => { intervals.push(callback); activeIntervals.set(intervals.length, callback); return intervals.length; },
      clearInterval: id => activeIntervals.delete(id),
    },
  });
  return {
    intervals,
    document,
    frame(milliseconds = 16) { time += milliseconds; const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(time)); },
    activeFrameCount() { return frames.size; },
    emit(name) { listeners.get(name)?.forEach(callback => callback()); },
    tick() { [...activeIntervals.values()].forEach(callback => callback()); },
    activeIntervalCount() { return activeIntervals.size; },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
    render(changes = {}) { cursor = 0; effects.length = 0; props = { ...props, ...changes }; return exports[name](props); },
    flushEffects() { effects.splice(0).forEach(callback => callback()); },
  };
}

function all(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  const children = node.props?.children;
  return (predicate(node) ? [node] : []).concat((Array.isArray(children) ? children : [children]).flatMap(child => Array.isArray(child) ? child.flatMap(child => all(child, predicate)) : all(child, predicate)));
}
function swipe(node, dx, dy = 0) {
  node.props.onTouchStart({ touches: [{ clientX: 200, clientY: 100 }] });
  node.props.onTouchEnd({ changedTouches: [{ clientX: 200 + dx, clientY: 100 + dy }] });
}
const about = 'app/about/_components/about-page.tsx';
const tour = 'app/tours/[tourId]/_components/single-tour-page.tsx';

function mountTeam(reducedMotion = false, members = [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }]) {
  const page = mount(about, 'TeamCarouselSection', { members }, reducedMotion);
  const element = { style: {} };
  let cardStep = 300;
  function render() {
    for (let i = 0; i < 3; i++) {
      const tree = page.render();
      const track = all(tree, node => node.props?.ref && node.props?.style?.willChange === 'transform')[0];
      if (!track.props.ref.current) { Object.assign(element.style, track.props.style); track.props.ref.current = element; }
      all(tree, node => node.type === 'team-card').forEach((card, index) => card.props.cardRef({
        get offsetLeft() { return Math.round(87 + index * cardStep); },
        getBoundingClientRect() { return { left: 87 + index * cardStep }; },
      }));
      page.flushEffects();
    }
    return page.render();
  }
  return { page, render, position: () => Number(element.style.transform.match(/translate3d\(-([\d.]+)px/)[1]),
    resize(step) { cardStep = step; page.emit('resize'); } };
}

test('team glides at a constant slow speed without stopping at card or loop boundaries', () => {
  const { page, render, position, resize } = mountTeam();
  render();
  assert.equal(position(), 1800);
  assert.equal(page.activeIntervalCount(), 0, 'Continuous motion has no interval between slides');
  page.frame();
  let previous = position();
  for (let i = 0; i < 3000; i++) {
    page.frame();
    const next = position();
    const distance = (next - previous + 900) % 900;
    assert.ok(Math.abs(distance - 0.384) < 0.00001, 'Every frame advances at 24 px/second, including across the loop');
    previous = next;
  }
  const progress = (position() - 1800) / 300;
  resize(400.25);
  assert.ok(Math.abs(position() - (2401.5 + progress * 400.25)) < 0.00001, 'Resize preserves fractional-pixel positions without rounding at loop boundaries');
  page.unmount();
  assert.equal(page.activeFrameCount(), 0);
});

test('team keeps gliding on hover, focus, arrow clicks and swipes', () => {
  const { page, render, position } = mountTeam();
  let tree = render();
  const distance = from => (position() - from + 900) % 900;
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, actual + ' should equal ' + expected);
  page.frame();
  let from = position();
  tree.props.onMouseEnter?.(); tree = render();
  for (let i = 0; i < 20; i++) page.frame();
  close(distance(from), 20 * 0.384);
  from = position();
  tree.props.onFocusCapture?.(); tree = render();
  for (let i = 0; i < 20; i++) page.frame();
  close(distance(from), 20 * 0.384);
  const arrow = direction => all(tree, node => node.props?.['aria-label'] === direction + ' team member')[0];
  from = position();
  arrow('Next').props.onClick();
  for (let i = 0; i < 43; i++) page.frame();
  close(distance(from), 300);
  from = position(); page.frame();
  close(distance(from), 0.384);
  from = position();
  arrow('Previous').props.onClick();
  for (let i = 0; i < 43; i++) page.frame();
  close(distance(from), 600);
  from = position(); page.frame();
  close(distance(from), 0.384);
  const gesture = all(tree, node => node.props?.onTouchStart)[0];
  from = position();
  swipe(gesture, -100);
  let prevented = false;
  gesture.props.onClickCapture({ preventDefault() { prevented = true; }, stopPropagation() {} });
  assert.equal(prevented, true);
  for (let i = 0; i < 43; i++) page.frame();
  close(distance(from), 300);
  from = position();
  swipe(gesture, 10, 100);
  for (let i = 0; i < 20; i++) page.frame();
  close(distance(from), 20 * 0.384);
  from = position();
  page.document.hidden = true;
  for (let i = 0; i < 20; i++) page.frame();
  assert.equal(position(), from);
  page.document.hidden = false;
  page.frame();
  close(distance(from), 0.384);
  page.unmount();
  assert.equal(page.activeFrameCount(), 0);
});

test('team reduced-motion preference disables the glide but keeps manual navigation', () => {
  const { page, render, position } = mountTeam(true);
  const tree = render();
  assert.equal(page.activeFrameCount(), 0);
  assert.equal(page.activeIntervalCount(), 0);
  const initial = position();
  all(tree, node => node.props?.['aria-label'] === 'Next team member')[0].props.onClick();
  assert.equal(position(), initial + 300);
  all(tree, node => node.props?.['aria-label'] === 'Previous team member')[0].props.onClick();
  assert.equal(position(), initial);
  page.unmount();
  const single = mountTeam(false, [{ name: 'Only' }]);
  assert.equal(all(single.render(), node => node.type === 'button').length, 0);
  assert.equal(single.page.activeFrameCount(), 0);
  single.page.unmount();
});

test('team card opens its biography on tap and toggles with the keyboard', () => {
  const card = mount(about, 'TeamCarouselCard', { member: { name: 'Guide', role: 'Expert', bio: 'Full biography', image: '' } });
  let tree = card.render();
  assert.equal(tree.props['aria-expanded'], false);
  tree.props.onClick();
  tree = card.render();
  assert.equal(tree.props['aria-expanded'], true);
  assert.ok(all(tree, node => node.props?.id === 'team-details')[0].props.className.includes('overflow-y-auto'));
  tree.props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(card.render().props['aria-expanded'], false);
});

test('tour photos swipe, wrap with arrows, select thumbnails, and advance automatically', () => {
  const selections = [];
  const page = mount(tour, 'TourGallery', { images: ['one', 'two', 'three'], selectedImage: 'one', selectedImageIndex: 0, onSelectImage: index => selections.push(index), title: 'Tour', tour: {}, tourType: 'Heritage' });
  const tree = page.render();
  const hero = all(tree, node => node.props?.onTouchStart)[0];
  const buttons = all(hero, node => node.type === 'button');
  assert.equal(buttons.length, 2, 'Both arrows belong over the main photo');
  buttons.find(node => node.props['aria-label'] === 'Previous photo').props.onClick();
  assert.equal(selections.pop(), 2);
  swipe(hero, -100);
  assert.equal(selections.pop(), 1);
  swipe(hero, 10, 100);
  assert.equal(selections.length, 0);
  all(tree, node => node.props?.['aria-label'] === 'View tour photo 3')[0].props.onClick();
  assert.equal(selections.pop(), 2);
  page.flushEffects();
  page.intervals[0]();
  assert.equal(selections.pop(), 1);
});

test('active thumbnail scrolls into view and reduced motion disables autoplay', () => {
  const page = mount(tour, 'TourGallery', { images: ['one', 'two', 'three'], selectedImage: 'three', selectedImageIndex: 2, onSelectImage() {}, title: 'Tour', tour: {}, tourType: 'Heritage' }, true);
  const tree = page.render();
  const strip = all(tree, node => node.props?.ref && node.type === 'div')[0];
  let scroll;
  strip.props.ref.current = {
    scrollLeft: 0, clientWidth: 200, getBoundingClientRect: () => ({ left: 0 }),
    children: [0, 1, 2].map(index => ({ getBoundingClientRect: () => ({ left: index * 100, width: 92 }) })),
    scrollTo: options => { scroll = options; },
  };
  page.flushEffects();
  assert.ok(scroll.left > 0);
  assert.equal(scroll.behavior, 'auto');
  assert.equal(page.intervals.length, 0);
});
