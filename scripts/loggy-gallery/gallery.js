/**
 * The browser half of assets/avatars/index.html (inlined by scripts/generate-loggy-gallery.js).
 * It reads the data embedded in the page and draws every pose, face and part.
 *
 * Each SVG is drawn inside its own shadow root: the generated files reuse ids (`#upper`,
 * `#hand-r`) and keyframe names across poses, and a shadow root keeps each one's style sheet to
 * itself. Loggy's greens are CSS custom properties, which do cross the shadow boundary, so a theme
 * change is one set of variables on the page. Motion is driven through the Web Animations API
 * (`getAnimations()`), which is what makes pause, speed and scrubbing work on CSS keyframes.
 *
 * Self-contained: no imports, and never a closing script tag.
 */
(function () {
  'use strict';

  const DATA = JSON.parse(document.getElementById('loggy-data').textContent);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STORAGE_KEY = 'loggy-gallery-v1';
  const FACE_LAYER = '@face';
  const ROLES = ['body', 'shade', 'deep'];
  const ROLE_LABELS = { body: 'Body', shade: 'Shade', deep: 'Deep' };
  const SPEEDS = [0.1, 0.25, 0.5, 1, 1.5, 2, 3];
  const STAGES = {
    card: ['Card', 'var(--page-card)'],
    base: ['Page', 'var(--page-base)'],
    checker: ['Checker', 'repeating-conic-gradient(#cfd3d1 0 25%, #f4f5f4 0 50%) 0 0 / 20px 20px'],
    white: ['White', '#ffffff'],
    black: ['Black', '#000000'],
  };
  const SHADOW_CSS =
    ':host{display:block;width:100%;height:100%}' +
    'svg{display:block;width:100%;height:100%;overflow:visible}' +
    DATA.paletteCss;

  const posesByName = new Map(DATA.poses.map((pose) => [pose.name, pose]));
  const facesByName = new Map(DATA.faces.map((face) => [face.name, face]));
  const themesById = new Map(DATA.themes.map((theme) => [theme.id, theme]));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = Object.assign(
    {
      theme: DATA.themes[0].id,
      pageTheme: DATA.themes[0].id,
      custom: null,
      stage: 'card',
      animated: true,
      playing: !reducedMotion,
      rate: 1,
      time: 0,
      thumb: 200,
      tab: 'poses',
    },
    loadState()
  );

  if (!themesById.has(state.pageTheme)) {
    state.pageTheme = DATA.themes[0].id;
  }

  if (state.theme !== 'custom' && !themesById.has(state.theme)) {
    state.theme = state.pageTheme;
  }

  // ── Small helpers ───────────────────────────────────────────────────────────

  function loadState() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');

      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  }

  function saveState() {
    try {
      const kept = Object.assign({}, state);

      delete kept.time;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
    } catch {
      // Storage can be off for file:// pages; the page works without it.
    }
  }

  /** `h('div', { class: 'card', onclick: fn }, child, …)` */
  function h(tag, attributes, ...children) {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(attributes || {})) {
      if (value === false || value === null || value === undefined) {
        continue;
      }

      if (key === 'class') {
        element.className = value;
      } else if (key.startsWith('on')) {
        element.addEventListener(key.slice(2), value);
      } else if (key === 'style') {
        element.style.cssText = value;
      } else {
        element.setAttribute(key, value === true ? '' : String(value));
      }
    }

    for (const child of children.flat()) {
      if (child !== null && child !== undefined && child !== false) {
        element.append(child);
      }
    }

    return element;
  }

  function svgFragment(markup) {
    const doc = new DOMParser().parseFromString(
      '<svg xmlns="' + SVG_NS + '">' + markup + '</svg>',
      'image/svg+xml'
    );

    return document.importNode(doc.documentElement.firstElementChild, true);
  }

  function partSvg(markup) {
    return '<svg xmlns="' + SVG_NS + '" viewBox="-60 0 640 700">' + markup + '</svg>';
  }

  function viewBoxRatio(viewBox) {
    const [, , width, height] = viewBox.split(/\s+/).map(Number);

    return width / height;
  }

  // ── Drawing SVGs ────────────────────────────────────────────────────────────

  const roots = new Set();
  let syncQueued = false;

  /** A host element whose shadow root holds `svgText`. Append the host, then it animates. */
  function mountSvg(svgText) {
    const host = h('div');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');

    root.innerHTML = svgText;
    style.textContent = SHADOW_CSS;
    root.prepend(style);
    roots.add(root);
    queueSync();

    return { host, root, svg: root.querySelector('svg') };
  }

  function animationsOf(root) {
    if (typeof root.getAnimations === 'function') {
      return root.getAnimations();
    }

    return Array.from(root.querySelectorAll('*')).flatMap((element) => element.getAnimations());
  }

  function syncRoot(root) {
    for (const animation of animationsOf(root)) {
      animation.playbackRate = state.rate;

      if (state.playing) {
        if (animation.playState !== 'running') {
          animation.play();
        }
      } else {
        animation.pause();
        animation.currentTime = state.time;
      }
    }
  }

  function syncAll() {
    syncQueued = false;

    for (const root of roots) {
      if (!root.host.isConnected) {
        roots.delete(root);
      } else {
        syncRoot(root);
      }
    }
  }

  function queueSync() {
    if (!syncQueued) {
      syncQueued = true;
      window.requestAnimationFrame(syncAll);
    }
  }

  /** The longest single loop on the page, for the scrubber's range. */
  function longestLoop() {
    let longest = 0;

    for (const root of roots) {
      for (const animation of animationsOf(root)) {
        const duration = animation.effect && animation.effect.getComputedTiming().duration;

        if (typeof duration === 'number' && duration > longest) {
          longest = duration;
        }
      }
    }

    return longest || 3000;
  }

  /** Zooms an SVG onto one element's box (its geometry, not its stroke, so a margin is added). */
  function cropTo(svg, target) {
    if (!svg || !target) {
      return;
    }

    try {
      const box = target.getBBox();

      if (!box.width || !box.height) {
        return;
      }

      const pad = Math.max(box.width, box.height) * 0.06 + 4;

      svg.setAttribute(
        'viewBox',
        [box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2].join(' ')
      );
    } catch {
      // Not rendered yet; the full canvas is still a correct picture.
    }
  }

  /** Puts `faceName` where the pose draws its own face, and marks the slot for layer toggles. */
  function applyFace(root, pose, faceName) {
    const slot = root.getElementById(facesByName.get(pose.face).id);

    if (!slot) {
      return;
    }

    if (faceName && faceName !== pose.face && facesByName.has(faceName)) {
      const replacement = svgFragment(facesByName.get(faceName).markup);

      replacement.setAttribute('data-face-slot', '');
      slot.replaceWith(replacement);
    } else {
      slot.setAttribute('data-face-slot', '');
    }
  }

  function applyHidden(root, hidden) {
    for (const id of hidden) {
      const element =
        id === FACE_LAYER ? root.querySelector('[data-face-slot]') : root.getElementById(id);

      if (element) {
        element.style.display = 'none';
      }
    }
  }

  function drawPose(pose, { animated, face, hidden }) {
    const mounted = mountSvg(animated ? pose.animated : pose.still);

    applyFace(mounted.root, pose, face);
    applyHidden(mounted.root, hidden || []);

    return mounted;
  }

  // ── Theme ───────────────────────────────────────────────────────────────────

  function loggyColors() {
    if (state.theme === 'custom' && state.custom) {
      return state.custom;
    }

    const theme = themesById.get(state.theme);

    return theme ? theme.loggy : DATA.classic;
  }

  function applyTheme() {
    const style = document.documentElement.style;
    const colors = loggyColors();
    const page = themesById.get(state.pageTheme);

    for (const role of ROLES) {
      style.setProperty('--loggy-' + role, colors[role]);
    }

    style.setProperty('--page-base', page.page.base);
    style.setProperty('--page-card', page.page.card);
    style.setProperty('--page-raised', page.page.raised);
    style.setProperty('--page-border', page.page.border);
    style.setProperty('--page-text', page.page.text);
    style.setProperty('--page-text-2', page.page.textSecondary);
    style.setProperty('--page-brand', page.page.brand);
    style.setProperty('--stage', (STAGES[state.stage] || STAGES.card)[1]);
    style.setProperty('--thumb', state.thumb + 'px');
    style.colorScheme = page.mode;

    for (const chip of document.querySelectorAll('[data-theme-chip]')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.themeChip === state.theme));
    }

    for (const role of ROLES) {
      const input = document.getElementById('color-' + role);

      if (input) {
        input.value = colors[role];
      }
    }
  }

  function chooseTheme(id) {
    state.theme = id;
    state.pageTheme = id;
    applyTheme();
    saveState();
  }

  function setCustomColor(role, value) {
    state.custom = Object.assign({}, loggyColors(), { [role]: value });
    state.theme = 'custom';
    applyTheme();
    saveState();
  }

  function swatches(colors) {
    return h(
      'span',
      { class: 'swatches', 'aria-hidden': 'true' },
      ROLES.map((role) => h('i', { style: 'background:' + colors[role] }))
    );
  }

  // ── Toolbar ─────────────────────────────────────────────────────────────────

  let playButton;
  let scrubber;
  let timeLabel;

  function updateMotionControls() {
    playButton.textContent = state.playing ? 'Pause' : 'Play';
    playButton.setAttribute('aria-pressed', String(!state.playing));
    scrubber.disabled = state.playing;
    scrubber.value = String(Math.round(state.time));
    timeLabel.textContent = state.playing ? '' : (state.time / 1000).toFixed(2) + ' s';
  }

  function toolbar() {
    const themeChips = DATA.themes.map((theme) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'data-theme-chip': theme.id,
          title: theme.id + ' (' + theme.mode + ')',
          onclick: () => chooseTheme(theme.id),
        },
        swatches(theme.loggy),
        theme.label
      )
    );
    const customChip = h(
      'button',
      {
        class: 'chip',
        type: 'button',
        'data-theme-chip': 'custom',
        title: 'Your own greens, on the current page theme',
        onclick: () => {
          state.custom = state.custom || Object.assign({}, loggyColors());
          state.theme = 'custom';
          applyTheme();
          saveState();
        },
      },
      'Custom'
    );
    const colorInputs = ROLES.map((role) =>
      h(
        'label',
        { class: 'color-input' },
        h('input', {
          id: 'color-' + role,
          type: 'color',
          oninput: (event) => setCustomColor(role, event.target.value),
        }),
        ROLE_LABELS[role]
      )
    );

    const animatedChip = h(
      'button',
      {
        class: 'chip',
        type: 'button',
        'aria-pressed': String(state.animated),
        title: 'Show the animated twins or the stills in the grids',
        onclick: () => {
          state.animated = !state.animated;
          animatedChip.setAttribute('aria-pressed', String(state.animated));
          saveState();
          renderTab(true);
        },
      },
      'Animated'
    );

    playButton = h('button', {
      class: 'chip',
      type: 'button',
      onclick: () => {
        if (state.playing) {
          state.playing = false;
          state.time = 0;
          scrubber.max = String(Math.ceil(longestLoop()));
        } else {
          state.playing = true;
        }

        saveState();
        updateMotionControls();
        syncAll();
      },
    });

    scrubber = h('input', {
      type: 'range',
      min: '0',
      max: '3000',
      step: '10',
      'aria-label': 'Animation time',
      oninput: (event) => {
        state.time = Number(event.target.value);
        updateMotionControls();
        syncAll();
      },
    });
    timeLabel = h('span', { class: 'time' });

    const speed = h(
      'select',
      {
        'aria-label': 'Speed',
        onchange: (event) => {
          state.rate = Number(event.target.value);
          saveState();
          syncAll();
        },
      },
      SPEEDS.map((value) =>
        h('option', { value: String(value), selected: value === state.rate }, value + '×')
      )
    );

    const stage = h(
      'select',
      {
        'aria-label': 'Background',
        onchange: (event) => {
          state.stage = event.target.value;
          applyTheme();
          saveState();
        },
      },
      Object.entries(STAGES).map(([key, [label]]) =>
        h('option', { value: key, selected: key === state.stage }, label)
      )
    );

    const size = h('input', {
      type: 'range',
      min: '110',
      max: '380',
      step: '10',
      value: String(state.thumb),
      'aria-label': 'Thumbnail size',
      oninput: (event) => {
        state.thumb = Number(event.target.value);
        applyTheme();
        saveState();
      },
    });

    updateMotionControlsLater();

    return h(
      'header',
      { class: 'toolbar' },
      h('h1', null, 'Loggy'),
      h(
        'div',
        { class: 'group' },
        h('span', { class: 'label' }, 'Theme'),
        themeChips,
        customChip,
        colorInputs
      ),
      h(
        'div',
        { class: 'group' },
        h('span', { class: 'label' }, 'Motion'),
        animatedChip,
        playButton,
        speed,
        scrubber,
        timeLabel
      ),
      h(
        'div',
        { class: 'group' },
        h('span', { class: 'label' }, 'Background'),
        stage,
        h('span', { class: 'label' }, 'Size'),
        size
      )
    );
  }

  function updateMotionControlsLater() {
    window.requestAnimationFrame(() => {
      if (!state.playing) {
        scrubber.max = String(Math.ceil(longestLoop()));
      }

      updateMotionControls();
    });
  }

  // ── Tabs ────────────────────────────────────────────────────────────────────

  const partCount = DATA.parts.reduce((sum, part) => sum + part.variants.length, 0);
  const TABS = [
    ['poses', 'Poses', DATA.poses.length],
    ['faces', 'Faces', DATA.faces.length],
    ['parts', 'Parts', partCount],
    ['themes', 'Themes and palette', DATA.themes.length],
  ];
  const panels = {};
  let tabButtons = [];

  function tabBar() {
    tabButtons = TABS.map(([key, label, count]) =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          'data-tab': key,
          onclick: () => {
            state.tab = key;
            saveState();
            renderTab(false);
          },
        },
        label + ' (' + count + ')'
      )
    );

    return h('nav', { class: 'tabs', role: 'tablist' }, tabButtons);
  }

  function renderTab(force) {
    for (const button of tabButtons) {
      button.setAttribute('aria-selected', String(button.dataset.tab === state.tab));
    }

    for (const [key, panel] of Object.entries(panels)) {
      panel.hidden = key !== state.tab;
    }

    if (!panels[state.tab]) {
      panels[state.tab] = h('section', { role: 'tabpanel' });
      main.append(panels[state.tab]);
      force = true;
    }

    if (force) {
      const panel = panels[state.tab];

      panel.replaceChildren();
      RENDERERS[state.tab](panel);
      queueSync();
    }
  }

  function card({ onclick, title, sub, ratio, label }) {
    const stage = h('div', {
      class: 'stage',
      style: ratio ? 'aspect-ratio:' + ratio : '',
    });
    const caption = h(
      'div',
      { class: 'caption' },
      h('b', null, title),
      sub ? h('span', null, sub) : null
    );
    const element = onclick
      ? h(
          'button',
          { class: 'card', type: 'button', onclick, 'aria-label': label || title },
          stage,
          caption
        )
      : h('div', { class: 'card' }, stage, caption);

    return { element, stage };
  }

  function renderPoses(panel) {
    panel.append(
      h('h2', null, 'Poses'),
      h(
        'p',
        null,
        'Every pose in loggy-parts/poses.json. Open one to see the still and the animated twin side by side, try any of the faces on it and hide its layers one by one.'
      )
    );

    const grid = h('div', { class: 'grid' });

    for (const pose of DATA.poses) {
      const { element, stage } = card({
        title: pose.name,
        sub:
          'face: ' +
          pose.face +
          (pose.alternateFaces ? ' · ships all ' + DATA.faces.length + ' faces' : ''),
        ratio: viewBoxRatio(pose.viewBox),
        onclick: () => openDetail(pose.name),
      });

      stage.append(drawPose(pose, { animated: state.animated }).host);
      grid.append(element);
    }

    panel.append(grid);
  }

  function renderFaces(panel) {
    panel.append(
      h('h2', null, 'Faces'),
      h(
        'p',
        null,
        'Every face in loggy-parts/faces, in faceOrder, drawn on the default pose. Open one to see it on any pose.'
      )
    );

    const pose = posesByName.get('default') || DATA.poses[0];
    const grid = h('div', { class: 'grid' });
    const crops = [];

    for (const face of DATA.faces) {
      const { element, stage } = card({
        title: face.name,
        sub: face.ownPoses.length ? 'own face of ' + face.ownPoses.join(', ') : 'alternate face',
        onclick: () => openDetail(pose.name, face.name),
      });
      const mounted = drawPose(pose, { animated: false, face: face.name });

      stage.append(mounted.host);
      grid.append(element);
      crops.push(mounted);
    }

    panel.append(grid);
    window.requestAnimationFrame(() => {
      for (const mounted of crops) {
        cropTo(mounted.svg, mounted.root.getElementById('body'));
      }
    });
  }

  function renderParts(panel) {
    panel.append(
      h('h2', null, 'Parts'),
      h(
        'p',
        null,
        'The part library in loggy-parts/<id>/<variant>.svg, each zoomed to its own drawing. Faces have their own tab. A part no pose stacks yet says so.'
      )
    );

    const crops = [];

    for (const part of DATA.parts) {
      const grid = h('div', { class: 'grid' });

      for (const variant of part.variants) {
        const { element, stage } = card({
          title: variant.variant,
          sub: variant.usedBy.length
            ? 'used by ' + variant.usedBy.join(', ')
            : 'not used by any pose yet',
          onclick: variant.usedBy.length ? () => openDetail(variant.usedBy[0]) : null,
          label: variant.ref + (variant.usedBy.length ? ', open ' + variant.usedBy[0] : ''),
        });
        const mounted = mountSvg(partSvg(variant.markup));

        stage.append(mounted.host);
        grid.append(element);
        crops.push(mounted);
      }

      panel.append(
        h(
          'div',
          { class: 'part-group' },
          h(
            'h3',
            null,
            part.id + ' ',
            h(
              'small',
              null,
              part.variants.length + (part.variants.length === 1 ? ' variant' : ' variants')
            )
          ),
          grid
        )
      );
    }

    window.requestAnimationFrame(() => {
      for (const mounted of crops) {
        cropTo(mounted.svg, mounted.svg.querySelector('g'));
      }
    });
  }

  function renderThemes(panel) {
    panel.append(
      h('h2', null, 'Every theme at once'),
      h(
        'p',
        null,
        "The greens from constants/loggyTheme.js, each on its own theme's page colour. Click one to switch the whole page to it."
      )
    );

    const pose = posesByName.get('wave') || DATA.poses[0];
    const grid = h('div', { class: 'grid' });

    for (const theme of DATA.themes) {
      const { element, stage } = card({
        title: theme.label,
        sub: theme.id + ' · ' + ROLES.map((role) => theme.loggy[role]).join(' '),
        ratio: viewBoxRatio(pose.viewBox),
        onclick: () => chooseTheme(theme.id),
      });
      const mounted = drawPose(pose, { animated: state.animated });

      stage.style.background = theme.page.base;

      for (const role of ROLES) {
        mounted.host.style.setProperty('--loggy-' + role, theme.loggy[role]);
      }

      stage.append(mounted.host);
      grid.append(element);
    }

    panel.append(grid, h('h2', null, 'Palette'));
    panel.append(
      h(
        'p',
        null,
        'loggy-parts/palette.css. The themed classes follow the chosen theme; every other colour is the same in every theme.'
      )
    );
    panel.append(
      h(
        'div',
        { class: 'palette' },
        DATA.palette.map((entry) => {
          const role = /--loggy-(\w+)/.exec(entry.fill);

          return h(
            'div',
            null,
            h('i', {
              style:
                'background:' +
                entry.fill +
                (entry.stroke ? ';outline:3px solid ' + entry.stroke + ';outline-offset:-3px' : ''),
            }),
            h(
              'span',
              null,
              h('code', null, '.' + entry.cls),
              h(
                'small',
                null,
                (entry.note || '') +
                  (role ? ' · themed: ' + role[1] : '') +
                  (entry.stroke ? ' · outlined' : '')
              )
            )
          );
        })
      )
    );
  }

  const RENDERERS = {
    poses: renderPoses,
    faces: renderFaces,
    parts: renderParts,
    themes: renderThemes,
  };

  // ── Pose detail ─────────────────────────────────────────────────────────────

  const dialog = h('dialog', { 'aria-labelledby': 'detail-title' });
  let detail = null;

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    dialog.replaceChildren();
    detail = null;
  });

  function openDetail(poseName, face) {
    const pose = posesByName.get(poseName);

    detail = { pose, face: face || pose.face, hidden: new Set() };
    renderDetail();

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function layerList(layers) {
    return h(
      'ul',
      null,
      layers.map((layer) => {
        const isFace = layer.face;
        const name = isFace ? 'face' : layer.id;
        const box = h('input', {
          type: 'checkbox',
          checked: !detail.hidden.has(layer.id),
          onchange: (event) => {
            if (event.target.checked) {
              detail.hidden.delete(layer.id);
            } else {
              detail.hidden.add(layer.id);
            }

            renderDetailStages();
          },
        });

        return h(
          'li',
          null,
          h(
            'label',
            null,
            box,
            name,
            layer.ref ? h('code', null, layer.ref) : null,
            isFace ? h('code', null, detail.face) : null,
            detail.pose.upper.includes(layer.id) ? h('code', null, '#upper') : null
          ),
          layer.children ? layerList(layer.children) : null
        );
      })
    );
  }

  let detailStages = null;

  function renderDetailStages() {
    if (!detailStages) {
      return;
    }

    const { still, animated } = detailStages;
    const options = { face: detail.face, hidden: [...detail.hidden] };

    still.replaceChildren(drawPose(detail.pose, Object.assign({ animated: false }, options)).host);
    animated.replaceChildren(
      drawPose(detail.pose, Object.assign({ animated: true }, options)).host
    );
    queueSync();
  }

  function renderDetail() {
    const { pose } = detail;
    const ratio = viewBoxRatio(pose.viewBox);
    const still = h('div', { class: 'stage', style: 'aspect-ratio:' + ratio });
    const animated = h('div', { class: 'stage', style: 'aspect-ratio:' + ratio });

    detailStages = { still, animated };

    const faceSelect = h(
      'select',
      {
        'aria-label': 'Face',
        onchange: (event) => {
          detail.face = event.target.value;
          renderDetail();
          dialog.querySelector('select').focus();
        },
      },
      DATA.faces.map((face) =>
        h(
          'option',
          { value: face.name, selected: face.name === detail.face },
          face.name + (face.name === pose.face ? ' (own face)' : '')
        )
      )
    );

    dialog.replaceChildren(
      h(
        'div',
        { class: 'detail-head' },
        h(
          'div',
          null,
          h('h2', { id: 'detail-title' }, pose.name),
          h('span', { class: 'time' }, 'viewBox ' + pose.viewBox)
        ),
        h(
          'button',
          {
            class: 'chip close',
            type: 'button',
            onclick: () => dialog.close(),
            'aria-label': 'Close',
          },
          '✕'
        )
      ),
      h(
        'div',
        { class: 'detail-body' },
        h(
          'div',
          null,
          h(
            'div',
            { class: 'pair' },
            h('div', null, h('h3', null, 'Still'), still),
            h('div', null, h('h3', null, 'Animated'), animated)
          ),
          h(
            'p',
            null,
            h(
              'a',
              { href: 'loggy-poses/loggy-' + pose.name + '.svg' },
              'loggy-poses/loggy-' + pose.name + '.svg'
            ),
            ' · ',
            h(
              'a',
              { href: 'loggy-animated/loggy-' + pose.name + '.svg' },
              'loggy-animated/loggy-' + pose.name + '.svg'
            ),
            ' · ',
            h(
              'a',
              { href: 'loggy-parts/animations/' + pose.name + '.css' },
              'loggy-parts/animations/' + pose.name + '.css'
            )
          )
        ),
        h(
          'div',
          { class: 'side' },
          h('h3', null, 'Face'),
          faceSelect,
          h('h3', null, 'Layers, bottom to top'),
          h('div', { class: 'layers' }, layerList(pose.layers)),
          h('h3', null, 'Parts'),
          h(
            'div',
            { class: 'refs' },
            pose.refs.map((ref) => h('code', null, ref))
          ),
          h('h3', null, 'Keyframes'),
          h('pre', null, pose.css)
        )
      )
    );

    renderDetailStages();
  }

  // ── Start ───────────────────────────────────────────────────────────────────

  const app = document.getElementById('app');
  const main = h('main');

  app.append(
    toolbar(),
    tabBar(),
    main,
    h(
      'footer',
      { style: 'padding:0 24px 32px;color:var(--page-text-2);font-size:13px' },
      "Generated from assets/avatars/loggy-parts by scripts/generate-loggy-gallery.js; run npm run generate-loggy after editing a part. Loggy's artwork is public domain (CC0 1.0, see LOGGY_LICENSE.txt)."
    ),
    dialog
  );

  if (!RENDERERS[state.tab]) {
    state.tab = 'poses';
  }

  applyTheme();
  renderTab(true);
})();
