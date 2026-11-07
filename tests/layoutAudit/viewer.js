/**
 * The browser half of `report.html`: reads the audit data embedded in the page and draws every
 * audited screen as a thumbnail, grouped by screen and compared across languages and phone
 * sizes. It is inlined into the report by `reportHtml.ts`, so it must stay one self-contained
 * file with no imports, and it must never contain a closing script tag. The pure parts (`filterEntries`, `groupSections`)
 * are exposed on `window.LayoutReport` for the tests.
 */
(function () {
  const SEVERITY_RANK = { error: 2, warn: 1, info: 0 };
  const GROUPS = [
    ['screens', 'Screens'],
    ['onboarding', 'Onboarding'],
    ['modals', 'Modals'],
    ['flows', 'Flows (state reached by tapping)'],
  ];
  const SEVERITY_LABEL = { error: 'error', warn: 'warning', info: 'note' };

  function defaultState(data) {
    return {
      query: '',
      group: 'all',
      locales: new Set(data.locales),
      profiles: new Set(data.profiles),
      severity: 'warn',
      hideAccepted: true,
      onlyIssues: false,
      outlines: true,
      sort: 'risk',
      thumb: 200,
    };
  }

  function visibleFindings(entry, state) {
    const threshold = SEVERITY_RANK[state.severity];
    return entry.findings.filter(
      (finding) =>
        SEVERITY_RANK[finding.s] >= threshold && !(state.hideAccepted && finding.a === true)
    );
  }

  /** Entries that pass every filter, each with the findings the current filters leave visible. */
  function filterEntries(data, state) {
    const query = state.query.trim().toLowerCase();
    const result = [];
    data.entries.forEach((entry) => {
      if (state.group !== 'all' && entry.group !== state.group) {
        return;
      }

      if (!state.locales.has(entry.locale) || !state.profiles.has(entry.profile)) {
        return;
      }

      if (query !== '' && entry.name.toLowerCase().indexOf(query) === -1) {
        return;
      }

      const findings = visibleFindings(entry, state);
      if (state.onlyIssues && findings.length === 0) {
        return;
      }

      result.push({ entry, findings });
    });

    return result;
  }

  /** Distinct defects, not occurrences: one finding seen on 15 pages counts once. */
  function countDistinct(items, severity) {
    const seen = new Set();
    items.forEach((item) => {
      item.findings.forEach((finding) => {
        if (finding.s === severity) {
          seen.add(finding.f);
        }
      });
    });

    return seen.size;
  }

  function groupSections(items, data, state) {
    const sections = new Map();
    items.forEach((item) => {
      const key = item.entry.group + ':' + item.entry.name;
      if (!sections.has(key)) {
        sections.set(key, {
          key,
          group: item.entry.group,
          name: item.entry.name,
          items: [],
          notes: [],
        });
      }

      const section = sections.get(key);
      section.items.push(item);
      if (item.entry.note && section.notes.indexOf(item.entry.note) === -1) {
        section.notes.push(item.entry.note);
      }
    });

    const profileOrder = new Map(data.profiles.map((profile, index) => [profile, index]));
    const localeOrder = new Map(data.locales.map((locale, index) => [locale, index]));
    const list = Array.from(sections.values());
    list.forEach((section) => {
      section.errors = countDistinct(section.items, 'error');
      section.warnings = countDistinct(section.items, 'warn');
      section.infos = countDistinct(section.items, 'info');
      section.items.sort(
        (a, b) =>
          localeOrder.get(a.entry.locale) - localeOrder.get(b.entry.locale) ||
          profileOrder.get(a.entry.profile) - profileOrder.get(b.entry.profile) ||
          passRank(a.entry.pass) - passRank(b.entry.pass)
      );
    });

    list.sort((a, b) => {
      const groupDelta = groupIndex(a.group) - groupIndex(b.group);
      if (groupDelta !== 0) {
        return groupDelta;
      }

      if (state.sort === 'risk') {
        const riskDelta = b.errors - a.errors || b.warnings - a.warnings;
        if (riskDelta !== 0) {
          return riskDelta;
        }
      }

      return a.name.localeCompare(b.name);
    });

    return list;
  }

  function findingTag(finding) {
    if (finding.a) {
      return 'accepted';
    }

    return finding.c ? 'app chrome, on every screen' : '';
  }

  function passRank(pass) {
    return pass === 'top' ? 0 : 1;
  }

  function groupIndex(group) {
    const index = GROUPS.findIndex((candidate) => candidate[0] === group);
    return index === -1 ? GROUPS.length : index;
  }

  function createElement(tag, props, children) {
    const element = document.createElement(tag);
    Object.keys(props || {}).forEach((name) => {
      const value = props[name];
      if (name === 'class') {
        element.className = value;
      } else if (name === 'text') {
        element.textContent = value;
      } else if (name.indexOf('on') === 0) {
        element.addEventListener(name.slice(2), value);
      } else if (value !== false && value !== null && value !== undefined) {
        element.setAttribute(name, value === true ? '' : String(value));
      }
    });

    (children || []).forEach((child) => {
      if (child) {
        element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      }
    });

    return element;
  }

  function pill(severity, count) {
    return createElement('span', {
      class: 'pill ' + severity,
      text: String(count),
      title: count + ' ' + SEVERITY_LABEL[severity] + (count === 1 ? '' : 's'),
    });
  }

  function percent(value, total) {
    return Math.round((value / total) * 10000) / 100 + '%';
  }

  /** Outline boxes over a screenshot, positioned in percent so they follow any image size. */
  function outlineBoxes(entry, findings, state) {
    if (!state.outlines) {
      return [];
    }

    const boxes = [];
    findings.forEach((finding, index) => {
      finding.r.forEach((rect) => {
        const box = createElement('div', {
          class: 'box ' + finding.s,
          'data-finding': index,
        });
        box.style.left = percent(rect[0], entry.viewport.w);
        box.style.top = percent(rect[1], entry.viewport.h);
        box.style.width = percent(rect[2], entry.viewport.w);
        box.style.height = percent(rect[3], entry.viewport.h);
        boxes.push(box);
      });
    });

    return boxes;
  }

  function frame(entry, findings, state, className) {
    const content = [];
    if (entry.shot) {
      content.push(
        createElement('img', {
          src: entry.shot,
          alt: entry.name + ' ' + entry.locale + ' ' + entry.profile,
          loading: 'lazy',
          decoding: 'async',
        })
      );
    } else {
      content.push(
        createElement('div', {
          class: 'missing',
          text: entry.note || 'no screenshot (' + entry.status + ')',
        })
      );
    }

    return createElement(
      'div',
      { class: className },
      content.concat(entry.shot ? outlineBoxes(entry, findings, state) : [])
    );
  }

  function severityClass(findings) {
    if (findings.some((finding) => finding.s === 'error')) {
      return ' has-error';
    }

    return findings.some((finding) => finding.s === 'warn') ? ' has-warn' : '';
  }

  function countOf(findings, severity) {
    return findings.filter((finding) => finding.s === severity).length;
  }

  function renderCard(item, state, open) {
    const entry = item.entry;
    const pills = [];
    ['error', 'warn', 'info'].forEach((severity) => {
      const count = countOf(item.findings, severity);
      if (count > 0 && SEVERITY_RANK[severity] >= SEVERITY_RANK[state.severity]) {
        pills.push(pill(severity, count));
      }
    });

    const label = entry.profile + (entry.pass === 'end' ? ' ↓' : '');
    return createElement(
      'button',
      {
        class: 'card' + severityClass(item.findings),
        type: 'button',
        title: entry.name + ' · ' + entry.locale + ' · ' + label,
        onclick: open,
      },
      [
        frame(entry, item.findings, state, 'frame'),
        createElement('div', { class: 'caption' }, [
          createElement('span', { text: label }),
          createElement('span', { class: 'pills' }, pills),
        ]),
      ]
    );
  }

  function renderSection(section, index, state, openAt) {
    const heading = [
      createElement('h3', { text: section.name }),
      section.errors > 0 ? pill('error', section.errors) : null,
      section.warnings > 0 ? pill('warn', section.warnings) : null,
      section.infos > 0 && state.severity === 'info' ? pill('info', section.infos) : null,
      section.errors + section.warnings + section.infos === 0 ? pill('ok', 0) : null,
    ];
    section.notes.forEach((note) => {
      heading.push(createElement('span', { class: 'note', text: note }));
    });

    const rows = [];
    const byLocale = new Map();
    section.items.forEach((item) => {
      if (!byLocale.has(item.entry.locale)) {
        byLocale.set(item.entry.locale, []);
      }

      byLocale.get(item.entry.locale).push(item);
    });
    byLocale.forEach((items, locale) => {
      rows.push(
        createElement('div', { class: 'row' }, [
          createElement('div', { class: 'row-label', text: locale }),
          createElement(
            'div',
            { class: 'cards' },
            items.map((item) => renderCard(item, state, () => openAt(item)))
          ),
        ])
      );
    });

    return createElement('section', { class: 'section', id: 'sec-' + index }, [
      createElement('div', { class: 'section-head' }, heading),
      createElement('div', null, rows),
    ]);
  }

  function renderToc(sections) {
    const nodes = [];
    let currentGroup = null;
    sections.forEach((section, index) => {
      if (section.group !== currentGroup) {
        currentGroup = section.group;
        const title = GROUPS.find((candidate) => candidate[0] === currentGroup);
        nodes.push(createElement('h2', { text: title ? title[1] : currentGroup }));
      }

      const count = section.errors + section.warnings;
      nodes.push(
        createElement('a', { href: '#sec-' + index }, [
          createElement('span', { text: section.name }),
          count > 0 ? pill(section.errors > 0 ? 'error' : 'warn', count) : null,
        ])
      );
    });

    return nodes;
  }

  function toggleChip(label, active, onToggle) {
    return createElement('button', {
      class: 'chip',
      type: 'button',
      text: label,
      'aria-pressed': active ? 'true' : 'false',
      onclick: onToggle,
    });
  }

  function init(data, root) {
    const state = defaultState(data);
    let flat = [];
    let lightboxIndex = -1;
    const mount = {
      summary: createElement('div', { class: 'summary' }),
      chipsLocale: createElement('span', { class: 'chips' }),
      chipsProfile: createElement('span', { class: 'chips' }),
      toc: createElement('nav', { class: 'toc' }),
      main: createElement('main'),
      lightbox: createElement('div', {
        class: 'lightbox',
        hidden: true,
        role: 'dialog',
        'aria-modal': 'true',
      }),
    };

    function setSetting(name, value) {
      state[name] = value;
      render();
    }

    function toggleIn(set, value) {
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }

      render();
    }

    function select(label, name, options) {
      const element = createElement(
        'select',
        {
          onchange: (event) => setSetting(name, event.target.value),
        },
        options.map((option) => createElement('option', { value: option[0], text: option[1] }))
      );
      element.value = state[name];
      return createElement('label', { class: 'control' }, [label, element]);
    }

    function checkbox(label, name) {
      const input = createElement('input', {
        type: 'checkbox',
        onchange: (event) => setSetting(name, event.target.checked),
      });
      input.checked = state[name];
      return createElement('label', { class: 'control' }, [input, label]);
    }

    const search = createElement('input', {
      type: 'search',
      placeholder: 'Filter by name…',
      'aria-label': 'Filter screens by name',
      oninput: (event) => setSetting('query', event.target.value),
    });
    const thumb = createElement('input', {
      type: 'range',
      min: 120,
      max: 340,
      step: 10,
      'aria-label': 'Thumbnail size',
      oninput: (event) => {
        state.thumb = Number(event.target.value);
        root.style.setProperty('--thumb', state.thumb + 'px');
      },
    });
    thumb.value = state.thumb;

    const bar = createElement('header', { class: 'bar' }, [
      createElement('div', { class: 'bar-top' }, [
        createElement('h1', { text: 'Layout audit' }),
        mount.summary,
      ]),
      createElement('div', { class: 'controls' }, [
        createElement('label', { class: 'control' }, [search]),
        select('Show', 'group', [['all', 'everything']].concat(GROUPS)),
        select('Findings', 'severity', [
          ['error', 'errors only'],
          ['warn', 'errors + warnings'],
          ['info', 'everything'],
        ]),
        select('Sort', 'sort', [
          ['risk', 'most issues first'],
          ['name', 'A–Z'],
        ]),
        checkbox('Only pages with findings', 'onlyIssues'),
        checkbox('Outlines', 'outlines'),
        checkbox('Hide accepted', 'hideAccepted'),
        createElement('label', { class: 'control' }, ['Size', thumb]),
      ]),
      createElement('div', { class: 'controls' }, [
        createElement('span', { class: 'control', text: 'Languages' }),
        mount.chipsLocale,
        createElement('span', { class: 'control', text: 'Phones' }),
        mount.chipsProfile,
      ]),
    ]);

    function renderChips() {
      mount.chipsLocale.replaceChildren.apply(
        mount.chipsLocale,
        data.locales.map((locale) =>
          toggleChip(locale, state.locales.has(locale), () => toggleIn(state.locales, locale))
        )
      );
      mount.chipsProfile.replaceChildren.apply(
        mount.chipsProfile,
        data.profiles.map((profile) =>
          toggleChip(profile, state.profiles.has(profile), () => toggleIn(state.profiles, profile))
        )
      );
    }

    function openAt(item) {
      lightboxIndex = flat.indexOf(item);
      renderLightbox();
    }

    function step(delta) {
      if (flat.length === 0) {
        return;
      }

      lightboxIndex = (lightboxIndex + delta + flat.length) % flat.length;
      renderLightbox();
    }

    function closeLightbox() {
      lightboxIndex = -1;
      mount.lightbox.hidden = true;
      mount.lightbox.replaceChildren();
    }

    function highlight(index, on) {
      mount.lightbox.querySelectorAll('.box').forEach((box) => {
        box.classList.toggle('hot', on && box.getAttribute('data-finding') === String(index));
      });
    }

    function renderLightbox() {
      const item = flat[lightboxIndex];
      if (!item) {
        closeLightbox();
        return;
      }

      const entry = item.entry;
      const findingNodes = item.findings.map((finding, index) =>
        createElement(
          'div',
          {
            class: 'finding' + (finding.a ? ' accepted' : ''),
            tabindex: 0,
            onmouseenter: () => highlight(index, true),
            onmouseleave: () => highlight(index, false),
            onfocus: () => highlight(index, true),
            onblur: () => highlight(index, false),
          },
          [
            createElement('span', { class: 'kind ' + finding.s, text: finding.k }),
            createElement('span', { class: 'note', text: findingTag(finding) }),
            createElement('span', { class: 'msg', text: finding.m }),
          ]
        )
      );

      const side = createElement('div', { class: 'lb-side' }, [
        createElement('button', {
          class: 'lb-close',
          type: 'button',
          'aria-label': 'Close',
          text: '×',
          onclick: closeLightbox,
        }),
        createElement('h2', { text: entry.name }),
        createElement('div', {
          class: 'lb-meta',
          text:
            entry.locale +
            ' · ' +
            entry.profile +
            ' · ' +
            entry.viewport.w +
            '×' +
            entry.viewport.h +
            (entry.pass === 'end' ? ' · scrolled to the end' : '') +
            ' · ' +
            (lightboxIndex + 1) +
            '/' +
            flat.length,
        }),
        createElement('div', { class: 'lb-nav' }, [
          createElement('button', { type: 'button', text: '← Previous', onclick: () => step(-1) }),
          createElement('button', { type: 'button', text: 'Next →', onclick: () => step(1) }),
        ]),
        entry.note ? createElement('div', { class: 'note', text: entry.note }) : null,
        findingNodes.length === 0
          ? createElement('div', { class: 'note', text: 'No findings at the current filter.' })
          : null,
      ]);
      findingNodes.forEach((node) => side.appendChild(node));

      mount.lightbox.replaceChildren(
        createElement(
          'div',
          {
            class: 'lb-stage',
            onclick: (event) => {
              if (event.target === event.currentTarget) {
                closeLightbox();
              }
            },
          },
          [frame(entry, item.findings, state, 'lb-frame')]
        ),
        side
      );
      mount.lightbox.hidden = false;
    }

    function render() {
      const items = filterEntries(data, state);
      const sections = groupSections(items, data, state);
      flat = [];
      sections.forEach((section) => {
        section.items.forEach((item) => flat.push(item));
      });

      const all = filterEntries(data, Object.assign({}, state, { onlyIssues: false }));
      const errors = countDistinct(all, 'error');
      const warnings = countDistinct(all, 'warn');
      mount.summary.replaceChildren(
        ...[
          createElement('b', { text: String(sections.length) }),
          ' screens · ',
          createElement('b', { text: String(flat.length) }),
          ' pages · ',
          createElement('b', { text: String(errors) }),
          ' distinct errors · ',
          createElement('b', { text: String(warnings) }),
          ' warnings · generated ' + data.generatedAt.slice(0, 16).replace('T', ' '),
        ].map((part) => (typeof part === 'string' ? document.createTextNode(part) : part))
      );
      mount.toc.replaceChildren(...renderToc(sections));
      mount.main.replaceChildren(
        ...(sections.length === 0
          ? [createElement('div', { class: 'empty', text: 'Nothing matches these filters.' })]
          : renderMain(sections))
      );
      renderChips();
      if (lightboxIndex >= 0) {
        closeLightbox();
      }
    }

    function renderMain(sections) {
      const nodes = [];
      let currentGroup = null;
      sections.forEach((section, index) => {
        if (section.group !== currentGroup) {
          currentGroup = section.group;
          const title = GROUPS.find((candidate) => candidate[0] === currentGroup);
          nodes.push(createElement('div', { class: 'group-title', text: title ? title[1] : '' }));
        }

        nodes.push(renderSection(section, index, state, openAt));
      });

      return nodes;
    }

    document.addEventListener('keydown', (event) => {
      if (lightboxIndex < 0) {
        return;
      }

      if (event.key === 'Escape') {
        closeLightbox();
      } else if (event.key === 'ArrowRight') {
        step(1);
      } else if (event.key === 'ArrowLeft') {
        step(-1);
      }
    });

    root.style.setProperty('--thumb', state.thumb + 'px');
    root.replaceChildren(
      bar,
      createElement('div', { class: 'layout' }, [mount.toc, mount.main]),
      mount.lightbox
    );
    root.style.setProperty('--bar-height', bar.offsetHeight + 'px');
    render();
    return { state, render, openAt, step, closeLightbox };
  }

  window.LayoutReport = { filterEntries, groupSections, defaultState, init };

  const dataElement = document.getElementById('layout-data');
  if (dataElement && !window.__LAYOUT_REPORT_NO_AUTOINIT__) {
    init(JSON.parse(dataElement.textContent), document.getElementById('app'));
  }
})();
