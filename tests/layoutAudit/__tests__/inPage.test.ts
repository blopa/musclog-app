/**
 * @jest-environment jsdom
 */
import {
  applyPseudoLocale,
  collectLayoutSnapshot,
  markBaseline,
  markBaselineOutsideLayer,
  scrollLargestToEnd,
} from '../inPage';

/**
 * jsdom has no layout, so each element declares its box in `data-rect="x,y,w,h"` and these stubs
 * answer the geometry calls the collector makes. What is under test is the collector's own
 * logic: which nodes it records, how it nests them, what it clips and what it can reach.
 */

function rectOf(element: Element) {
  const raw = element.getAttribute('data-rect');
  const [x, y, w, h] = raw ? raw.split(',').map(Number) : [0, 0, 0, 0];
  return {
    left: x,
    top: y,
    width: w,
    height: h,
    right: x + w,
    bottom: y + h,
    x,
    y,
    toJSON: () => ({}),
  };
}

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    return rectOf(this) as DOMRect;
  };
  Range.prototype.getClientRects = function () {
    const container = this.startContainer;
    const parent =
      container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as Element);
    const box = rectOf(parent ?? document.body);
    // `data-lines="2"` stands for text the browser wrapped onto two lines.
    const rects =
      parent?.getAttribute('data-lines') === '2' ? [box, { ...box, top: box.top + 20 }] : [box];
    return rects as unknown as DOMRectList;
  };
  document.elementFromPoint = () => null;
});

function render(html: string, viewport = { width: 360, height: 780 }) {
  document.body.innerHTML = html;
  Object.defineProperty(window, 'innerWidth', { value: viewport.width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: viewport.height, configurable: true });
}

function scroller(selector: string, scrollHeight: number, clientHeight: number) {
  const element = document.querySelector(selector) as HTMLElement;
  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
}

const byLabel = (snapshot: ReturnType<typeof collectLayoutSnapshot>, label: string) =>
  snapshot.nodes.find((node) => node.label === label);

describe('collectLayoutSnapshot', () => {
  it('records a control and its label as two nodes, the label nested in the control', () => {
    render('<button data-rect="10,10,100,40">Save</button>');
    const snapshot = collectLayoutSnapshot({ onlyNew: false });
    expect(snapshot.nodes.map((node) => node.kind)).toEqual(['interactive', 'text']);
    expect(snapshot.nodes[1].parent).toBe(snapshot.nodes[0].id);
    expect(snapshot.viewport).toEqual({ width: 360, height: 780 });
  });

  it('finds controls by role and tabindex, and skips plain wrappers', () => {
    render(`
      <div data-rect="0,0,360,100">
        <div role="button" data-rect="0,0,100,40"></div>
        <div tabindex="0" data-rect="0,50,100,40"></div>
        <div tabindex="-1" data-rect="0,100,100,40"></div>
      </div>`);
    const snapshot = collectLayoutSnapshot({ onlyNew: false });
    expect(snapshot.nodes.map((node) => node.kind)).toEqual(['interactive', 'interactive']);
  });

  it('skips what is not displayed, with everything under it', () => {
    render(`
      <div style="display:none" data-rect="0,0,10,10"><p data-rect="0,0,10,10">hidden</p></div>
      <div style="opacity:0" data-rect="0,0,10,10"><p data-rect="0,0,10,10">faded</p></div>
      <p data-rect="0,50,80,20">shown</p>`);
    const labels = collectLayoutSnapshot({ onlyNew: false }).nodes.map((node) => node.label);
    expect(labels).toEqual(['shown']);
  });

  it('measures the ink an overflow:hidden parent cuts off', () => {
    render(`
      <div data-rect="0,0,100,20" style="overflow-x:hidden;overflow-y:hidden">
        <p data-rect="0,0,150,20">Too long for its box</p>
      </div>`);
    const text = byLabel(collectLayoutSnapshot({ onlyNew: false }), 'Too long for its box');
    expect(text?.lossRatio).toBeCloseTo(0.33, 2);
    expect(text?.rects[0].w).toBe(100);
  });

  it('does not call the edge of a scroller a cut: a clip outside it is the scroll edge', () => {
    render(`
      <div data-rect="0,0,360,200" style="overflow-x:hidden;overflow-y:hidden">
        <div id="s" data-rect="0,0,360,200" style="overflow-x:hidden;overflow-y:auto">
          <p data-rect="0,180,100,40">Straddles the edge</p>
        </div>
      </div>`);
    scroller('#s', 600, 200);
    const text = byLabel(collectLayoutSnapshot({ onlyNew: false }), 'Straddles the edge');
    expect(text?.lossRatio).toBe(0);
    // It is still only half on screen right now.
    expect(text?.visible[0].h).toBe(20);
  });

  it('still calls the same overlap a cut when nothing scrolls', () => {
    render(`
      <div data-rect="0,0,360,200" style="overflow-x:hidden;overflow-y:hidden">
        <p data-rect="0,180,100,40">Really cut</p>
      </div>`);
    expect(byLabel(collectLayoutSnapshot({ onlyNew: false }), 'Really cut')?.lossRatio).toBe(0.5);
  });

  it('separates scroll contexts so a scrolled row is not judged against a fixed bar', () => {
    render(`
      <div id="s" data-rect="0,0,360,700" style="overflow-y:auto;overflow-x:hidden">
        <p data-rect="0,10,100,20">In the list</p>
      </div>
      <div style="position:fixed" data-rect="0,700,360,80"><p data-rect="0,710,100,20">In the bar</p></div>`);
    scroller('#s', 2000, 700);
    const snapshot = collectLayoutSnapshot({ onlyNew: false });
    const contexts = ['In the list', 'In the bar'].map(
      (label) => byLabel(snapshot, label)?.scrollContext
    );
    expect(contexts[0]).toMatch(/^scroll:/);
    expect(contexts[1]).toMatch(/^fixed:/);
  });

  it('knows whether off-screen content can be scrolled into view', () => {
    render(`
      <p data-rect="400,0,50,20">Off to the right</p>
      <div id="s" data-rect="0,0,360,300" style="overflow-y:auto;overflow-x:hidden">
        <p data-rect="0,900,50,20">Far down the list</p>
      </div>
      <p data-rect="0,900,50,20">Far down the page</p>`);
    scroller('#s', 2000, 300);
    const snapshot = collectLayoutSnapshot({ onlyNew: false });
    expect(byLabel(snapshot, 'Off to the right')?.reachable).toBe(false);
    expect(byLabel(snapshot, 'Far down the list')?.reachable).toBe(true);
    expect(byLabel(snapshot, 'Far down the page')?.reachable).toBe(false);
  });

  it('reports a text cut by an ellipsis as truncated, not as lost ink', () => {
    render(
      '<p id="t" data-rect="0,0,100,20" style="text-overflow:ellipsis;overflow-x:hidden;overflow-y:hidden">A long name</p>'
    );
    const element = document.querySelector('#t') as HTMLElement;
    Object.defineProperty(element, 'scrollWidth', { value: 180, configurable: true });
    Object.defineProperty(element, 'clientWidth', { value: 100, configurable: true });
    const text = byLabel(collectLayoutSnapshot({ onlyNew: false }), 'A long name');
    expect(text?.truncated).toBe(true);
    expect(text?.lossRatio).toBe(0);
  });

  it("records a field's content box, so padding reserved for a control laid over it counts", () => {
    render(
      '<input id="f" aria-label="Barcode" data-rect="0,0,300,48" style="border:0;padding:0 40px 0 16px" />' +
        '<input id="g" aria-label="Plain" data-rect="0,100,300,48" style="border:0;padding:0" />'
    );
    const snapshot = collectLayoutSnapshot({ onlyNew: false });
    expect(byLabel(snapshot, 'Barcode')?.rects).toEqual([{ x: 16, y: 0, w: 244, h: 48 }]);
    // No padding: the whole box is where the text can be.
    expect(byLabel(snapshot, 'Plain')?.rects).toEqual([{ x: 0, y: 100, w: 300, h: 48 }]);
  });

  it('names the words a layout split across lines, but not hyphenated or short ones', () => {
    render('<p data-lines="2" data-rect="0,0,100,40">Сканировать штрих-код и ещё</p>');
    const text = collectLayoutSnapshot({ onlyNew: false }).nodes[0];
    expect(text.brokenWords).toEqual(['Сканировать', 'ещё'].filter((word) => word.length >= 4));
    expect(text.brokenWords).not.toContain('штрих-код');
    expect(text.brokenWords).not.toContain('и');
  });

  it('reports no broken word for one-line text', () => {
    render('<p data-rect="0,0,100,20">Единственная строка</p>');
    expect(collectLayoutSnapshot({ onlyNew: false }).nodes[0].brokenWords).toEqual([]);
  });

  it('records only what appeared since the baseline when asked for the new layer', () => {
    render('<p data-rect="0,0,100,20">Page</p>');
    markBaseline();
    const sheet = document.createElement('div');
    sheet.setAttribute('data-rect', '0,400,360,380');
    sheet.innerHTML = '<p data-rect="10,410,100,20">Sheet title</p>';
    document.body.appendChild(sheet);

    expect(collectLayoutSnapshot({ onlyNew: false }).nodes.map((node) => node.label)).toEqual([
      'Page',
      'Sheet title',
    ]);
    expect(collectLayoutSnapshot({ onlyNew: true }).nodes.map((node) => node.label)).toEqual([
      'Sheet title',
    ]);
  });

  it('isolates a sheet portalled out of the page, so the page it covers is not measured', () => {
    render(`
      <div id="root"><p data-rect="0,0,100,20">Page</p></div>
      <div id="portal"><div data-rect="0,400,360,380"><p id="inner" data-testid="intro" data-rect="10,410,100,20">Welcome</p></div></div>`);

    expect(markBaselineOutsideLayer('[data-testid="intro"]')).toBe(true);
    expect(collectLayoutSnapshot({ onlyNew: true }).nodes.map((node) => node.label)).toEqual([
      'Welcome',
    ]);
  });

  it('refuses to isolate a sheet that lives in the page itself, and stamps nothing', () => {
    render(`<div id="root"><p data-testid="intro" data-rect="0,0,100,20">Welcome</p></div>`);

    expect(markBaselineOutsideLayer('[data-testid="intro"]')).toBe(false);
    expect(collectLayoutSnapshot({ onlyNew: true }).nodes.map((node) => node.label)).toEqual([
      'Welcome',
    ]);
  });

  it('reports a missing sheet as not isolated', () => {
    render('<div id="root"></div>');
    expect(markBaselineOutsideLayer('[data-testid="missing"]')).toBe(false);
  });

  it('marks a control covered by a layer outside its own scroller as scrolling under it', () => {
    render(`
      <div id="screen">
        <div id="list" style="overflow-y:auto"><button data-rect="0,300,100,40">Pay</button></div>
        <div id="bar" data-rect="0,280,360,80">Continue</div>
      </div>`);
    scroller('#list', 900, 500);
    const bar = document.querySelector('#bar') as Element;
    document.elementFromPoint = () => bar;
    const control = collectLayoutSnapshot({ onlyNew: false }).nodes.find(
      (node) => node.kind === 'interactive'
    );
    expect(control?.coveredShare).toBe(1);
    // The bar is absolute over the scroller, not fixed, yet the list scrolls under it.
    expect(control?.coveredByFixed).toBe(true);
    document.elementFromPoint = () => null;
  });

  it('does not excuse a control covered by something inside its own scroller', () => {
    render(`
      <div id="list" style="overflow-y:auto">
        <button data-rect="0,300,100,40">Pay</button>
        <div id="banner" data-rect="0,300,100,40">Banner</div>
      </div>`);
    scroller('#list', 900, 500);
    const banner = document.querySelector('#banner') as Element;
    document.elementFromPoint = () => banner;
    const control = collectLayoutSnapshot({ onlyNew: false }).nodes.find(
      (node) => node.kind === 'interactive'
    );
    expect(control?.coveredShare).toBe(1);
    expect(control?.coveredByFixed).toBe(false);
    document.elementFromPoint = () => null;
  });

  it('hit-tests a control and names what is on top of it', () => {
    render(`
      <button id="b" data-rect="0,0,100,40">Pay</button>
      <div id="cover" data-rect="0,0,100,40" aria-label="Banner"></div>`);
    const cover = document.querySelector('#cover') as Element;
    document.elementFromPoint = () => cover;
    const control = collectLayoutSnapshot({ onlyNew: false }).nodes.find(
      (node) => node.kind === 'interactive'
    );
    expect(control?.coveredShare).toBe(1);
    expect(control?.coveredBy).toContain('Banner');
    document.elementFromPoint = () => null;
  });

  it('counts a control as clear when the hit lands on itself or its own content', () => {
    render('<button id="b" data-rect="0,0,100,40"><span data-rect="0,0,50,20">Pay</span></button>');
    const button = document.querySelector('#b') as Element;
    document.elementFromPoint = () => button.firstElementChild;
    const control = collectLayoutSnapshot({ onlyNew: false }).nodes.find(
      (node) => node.kind === 'interactive'
    );
    expect(control?.coveredShare).toBe(0);
    expect(control?.coveredBy).toBeNull();
    document.elementFromPoint = () => null;
  });
});

describe('scrollLargestToEnd', () => {
  it('scrolls the biggest scroller to its end and says whether anything moved', () => {
    render(`
      <div id="small" style="overflow-y:auto" data-rect="0,0,100,100"></div>
      <div id="big" style="overflow-y:auto" data-rect="0,0,360,700"></div>`);
    scroller('#small', 300, 100);
    scroller('#big', 2000, 700);
    for (const [id, width, height] of [
      ['small', 100, 100],
      ['big', 360, 700],
    ] as const) {
      const element = document.getElementById(id) as HTMLElement;
      Object.defineProperty(element, 'clientWidth', { value: width, configurable: true });
      Object.defineProperty(element, 'clientHeight', { value: height, configurable: true });
    }

    expect(scrollLargestToEnd(false)).toBe(true);
    expect((document.getElementById('big') as HTMLElement).scrollTop).toBe(2000);
    expect((document.getElementById('small') as HTMLElement).scrollTop).toBe(0);
  });

  it('reports false when nothing scrolls', () => {
    render('<p data-rect="0,0,100,20">Short page</p>');
    expect(scrollLargestToEnd(false)).toBe(false);
  });
});

describe('applyPseudoLocale', () => {
  const text = (selector: string) => document.querySelector(selector)?.textContent ?? '';

  it('lengthens readable strings by about the factor without changing word boundaries', () => {
    render('<p id="a">Weekly Review</p><p id="b">Недельный обзор</p>');
    const changed = applyPseudoLocale(1.4);
    expect(changed).toBe(2);
    expect(text('#a').length).toBeGreaterThanOrEqual(Math.ceil('Weekly Review'.length * 1.3));
    expect(text('#a').split(' ')).toHaveLength(2);
    expect(text('#b').length).toBeGreaterThan('Недельный обзор'.length);
  });

  it('leaves numbers and strings under three letters alone', () => {
    render('<p id="a">1,300</p><p id="b">OK</p><p id="c">kg</p>');
    expect(applyPseudoLocale(1.4)).toBe(0);
    expect([text('#a'), text('#b'), text('#c')]).toEqual(['1,300', 'OK', 'kg']);
  });

  it('is idempotent, and stretches again a string the app has rewritten since', () => {
    render('<p id="a">Remaining</p>');
    applyPseudoLocale(1.4);
    const once = text('#a');
    expect(applyPseudoLocale(1.4)).toBe(0);
    expect(text('#a')).toBe(once);

    (document.querySelector('#a')?.firstChild as Text).data = 'Remaining';
    expect(applyPseudoLocale(1.4)).toBe(1);
    expect(text('#a')).toBe(once);
  });

  it('does not touch scripts, styles or text areas', () => {
    render('<textarea id="t">Some typed words</textarea><style id="s">.a { color: red }</style>');
    expect(applyPseudoLocale(1.4)).toBe(0);
    expect(text('#t')).toBe('Some typed words');
  });
});
