"""Helpers for redrawing part of a raster reference as clean SVG paths.

Import this from a throwaway generator script (see references/loggy-hands-example.py).
Finish with save(), which writes the structured format of assets/avatars/loggy.svg.
Needs ImageMagick (`magick`), Node and the repo's `sharp` package.
"""
import base64
import math
import re
import struct
import subprocess
import xml.dom.minidom
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
SUPPORTED_COMMANDS = 'MLCQZ'
STYLE_PROPERTIES = ('fill', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width')


def crop(ref, x, y, w, h, out, zoom=3):
    """Cut a region out of the reference and enlarge it. Paths are authored in these pixels."""
    subprocess.run(
        ['magick', str(ref), '-crop', f'{w}x{h}+{x}+{y}', '+repage', '-resize', f'{zoom * 100}%', str(out)],
        check=True,
    )


def render(svg, png, background='#111', density=200):
    subprocess.run(['node', str(HERE / 'render.js'), str(svg), str(png), background, str(density)], check=True)


def png_size(path):
    with open(path, 'rb') as f:
        header = f.read(24)
    return struct.unpack('>II', header[16:24])


def proof(image, paths, out, grid=0, color='#ff2bd6'):
    """Draw authored paths (crop pixels) over a crop. grid=50 adds labelled guide lines every 50px."""
    w, h = png_size(image)
    data = base64.b64encode(Path(image).read_bytes()).decode()
    marks = ''
    if grid:
        for x in range(grid, w, grid):
            marks += f'<path d="M{x} 0V{h}" stroke="#00e5ff" stroke-width="1" opacity=".55"/>'
            marks += f'<text x="{x + 2}" y="12" fill="#00e5ff" font-size="12" font-family="monospace">{x}</text>'
        for y in range(grid, h, grid):
            marks += f'<path d="M0 {y}H{w}" stroke="#00e5ff" stroke-width="1" opacity=".55"/>'
            marks += f'<text x="2" y="{y - 2}" fill="#00e5ff" font-size="12" font-family="monospace">{y}</text>'
    lines = ''.join(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="3"/>' for d in paths)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<image width="{w}" height="{h}" xlink:href="data:image/png;base64,{data}"/>{marks}{lines}</svg>'
    )
    tmp = Path(out).with_suffix('.proof.svg')
    tmp.write_text(svg)
    render(tmp, out, density=72)


def compare(pngs, out, height=560, background='#111'):
    """Put renders and proofs side by side at one height."""
    args = ['magick']
    for png in pngs:
        args += ['(', str(png), '-resize', f'x{height}', ')']
    subprocess.run(args + ['-background', background, '+append', str(out)], check=True)


def mapper(crop_anchor, svg_anchor, scale, rotate=0):
    """Return T(x, y): crop pixels -> SVG units.

    The two anchors are the same feature in each space. Negative rotate turns
    counter-clockwise on screen. Usual scale: svg_width / reference_width / zoom.
    """
    th = math.radians(rotate)
    cos, sin = math.cos(th), math.sin(th)

    def transform(x, y):
        dx, dy = (x - crop_anchor[0]) * scale, (y - crop_anchor[1]) * scale
        return dx * cos - dy * sin + svg_anchor[0], dx * sin + dy * cos + svg_anchor[1]

    return transform


def map_path(d, transform):
    """Map an absolute M/L/C/Q/Z path. Anything else raises rather than silently distorting."""
    out = ''
    for command, args in re.findall(r'([A-Za-z])([^A-Za-z]*)', d):
        if command not in SUPPORTED_COMMANDS:
            raise ValueError(f'Unsupported path command {command!r}: author with absolute M L C Q Z')
        numbers = [float(n) for n in re.findall(r'-?\d*\.?\d+', args)]
        if len(numbers) % 2:
            raise ValueError(f'Odd coordinate count after {command!r}: {args!r}')
        pairs = [transform(numbers[i], numbers[i + 1]) for i in range(0, len(numbers), 2)]
        out += command + ' '.join(f'{x:.1f} {y:.1f}' for x, y in pairs)
    return out


def outlined(d, transform, fill, stroke, width):
    return (
        f'<path fill="{fill}" stroke="{stroke}" stroke-width="{width}" '
        f'stroke-linejoin="round" d="{map_path(d, transform)}"/>'
    )


def filled(d, transform, fill):
    return f'<path fill="{fill}" d="{map_path(d, transform)}"/>'


def group_span(svg, group_id):
    """Find a whole <g id=...>...</g>, counting nested groups so the right </g> is used."""
    start = svg.index(f'<g id="{group_id}"')
    depth = 0
    for match in re.finditer(r'<g[\s>]|</g>', svg[start:]):
        depth += -1 if match.group() == '</g>' else 1
        if depth == 0:
            return start, start + match.end()
    raise ValueError(f'Group {group_id!r} is never closed')


def get_group(svg, group_id):
    start, end = group_span(svg, group_id)
    return svg[start:end]


def replace_group(svg, group_id, markup):
    start, end = group_span(svg, group_id)
    return svg[:start] + markup + svg[end:]


def insert_before_group(svg, group_id, markup):
    start, _ = group_span(svg, group_id)
    return svg[:start] + markup + svg[start:]


def append_to_group(svg, group_id, markup):
    """Add as the group's last child, e.g. a new face variant at the end of body."""
    _, end = group_span(svg, group_id)
    end -= len('</g>')
    return svg[:end] + markup + svg[end:]


def group(group_id, *children, hidden=False):
    display = ' display="none"' if hidden else ''
    return f'<g id="{group_id}"{display}>' + ''.join(children) + '</g>'


def face_variant(name, **parts):
    """A hidden face: face_variant('wink', brow_l=..., mouth=..., extras=...)."""
    children = [group(f'face-{name}-{part.replace("_", "-")}', markup) for part, markup in parts.items()]
    return group(f'face-{name}', *children, hidden=True)


def document(width, height, *groups):
    """Start a new drawing from nothing."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">' + ''.join(groups) + '</svg>'
    )


def palette(svg):
    """Most used colours in the target, so new shapes match the file rather than the reference."""
    return Counter(c.lower() for c in re.findall(r'#[0-9A-Fa-f]{6}', svg)).most_common()


def format_number(value):
    text = f'{value:.1f}'.rstrip('0').rstrip('.')
    return '0' if text in ('', '-0') else text


def join_numbers(values):
    """Space-separate, except that a minus sign already separates: 1.4 5.6-0.3-1."""
    out = ''
    for value in values:
        text = format_number(value)
        out += text if not out or text.startswith('-') else ' ' + text
    return out


def relative_path(d):
    """Absolute M/L/C/Q/Z to relative, measuring from rounded points so errors can't accumulate."""
    points_per_segment = {'M': 1, 'L': 1, 'Q': 2, 'C': 3}
    out, pen, start = '', (0, 0), (0, 0)
    for command, args in re.findall(r'([A-Za-z])([^A-Za-z]*)', d):
        if command == 'Z':
            out, pen = out + 'z', start
            continue
        if command not in points_per_segment:
            raise ValueError(f'Unsupported path command {command!r}: author with absolute M L C Q Z')
        numbers = [round(float(n), 1) for n in re.findall(r'-?\d*\.?\d+', args)]
        points = list(zip(numbers[0::2], numbers[1::2]))
        if command == 'M':
            start = points[0]
        step, values = points_per_segment[command], []
        for i in range(0, len(points), step):
            segment = points[i : i + step]
            for x, y in segment:
                values += [x - pen[0], y - pen[1]]
            pen = segment[-1]
        out += command.lower() + join_numbers(values)
    return out


def house_style(svg):
    """Rewrite any tracekit output in the format of assets/avatars/loggy.svg.

    Existing classes keep their numbers and existing relative paths stay untouched,
    so editing that file produces a small diff. Only new styles get new classes.
    """
    root = ET.fromstring(svg, parser=ET.XMLParser(target=ET.TreeBuilder(insert_comments=True)))

    def tag(element):
        return element.tag.split('}')[-1] if isinstance(element.tag, str) else 'comment'

    style = next((child for child in root if tag(child) == 'style'), None)
    css = [line for line in style.text.split('\n') if line.strip()] if style is not None else []
    known = {}
    for name, body in re.findall(r'\.(s\d+)\s*\{([^}]*)\}', '\n'.join(css)):
        known[body.strip().lower()] = name

    def class_for(path):
        props = [(key, path.get(key)) for key in STYLE_PROPERTIES if path.get(key)]
        if not props:
            return path.get('class')
        body = ';'.join(f'{key}: {value.lower()}' for key, value in props)
        if body not in known:
            known[body] = f's{max((int(n[1:]) for n in known.values()), default=-1) + 1}'
            css.append(f'\t\t.{known[body]} {{ {body} }}')
        return known[body]

    def write(element, depth):
        pad = '\t' * depth
        if tag(element) in ('style', 'title', 'desc'):
            return []
        if tag(element) == 'comment':
            return [f'{pad}<!--{element.text}-->']
        if tag(element) == 'path':
            d = element.get('d')
            d = relative_path(d) if re.search('[A-Z]', d) else d
            return [f'{pad}<path class="{class_for(element)}" d="{d}"/>']
        if tag(element) != 'g':
            raise ValueError(f'Only g and path belong in the drawing, found {tag(element)}')
        display = f' display="{element.get("display")}"' if element.get('display') else ''
        lines = [f'{pad}<g id="{element.get("id")}"{display}>']
        for child in element:
            lines += write(child, depth + 1)
        return lines + [f'{pad}</g>']

    body = []
    for child in root:
        body += write(child, 1)
    view_box = root.get('viewBox')
    _, _, width, height = view_box.split()
    head = f'<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" width="{width}" height="{height}">'
    return '\n'.join([head, '\t<style>', *css, '\t</style>', *body, '</svg>'])


def save(svg, out):
    Path(out).write_text(house_style(svg))
    return check(out)


def path_points(d):
    """Every point of a path, control points included, for bounds checks."""
    arity = {'m': 2, 'l': 2, 'h': 1, 'v': 1, 'q': 4, 'c': 6}
    x = y = start_x = start_y = 0
    points = []
    for command, args in re.findall(r'([A-Za-z])([^A-Za-z]*)', d):
        kind, relative = command.lower(), command.islower()
        if kind == 'z':
            x, y = start_x, start_y
            continue
        numbers = [float(n) for n in re.findall(r'-?\d*\.?\d+', args)]
        for i in range(0, len(numbers), arity[kind]):
            segment = numbers[i : i + arity[kind]]
            if kind == 'h':
                x = segment[0] + (x if relative else 0)
            elif kind == 'v':
                y = segment[0] + (y if relative else 0)
            else:
                base_x, base_y = (x, y) if relative else (0, 0)
                pairs = [(segment[j] + base_x, segment[j + 1] + base_y) for j in range(0, len(segment), 2)]
                points += pairs
                x, y = pairs[-1]
            points.append((x, y))
            if kind == 'm' and i == 0:
                start_x, start_y = x, y
    return points


def check(path):
    """Report what a render won't show: broken XML, repeated ids, format slips, stray points."""
    xml.dom.minidom.parse(str(path))
    svg = Path(path).read_text()
    problems = [f'duplicate id: {i}' for i, n in Counter(re.findall(r'\bid="([^"]+)"', svg)).items() if n > 1]
    defined = set(re.findall(r'\.(s\d+)\s*\{', svg))
    problems += [f'undefined class: {c}' for c in sorted(set(re.findall(r'class="(s\d+)"', svg)) - defined)]
    problems += [f'{n} paths without a class' for n in [len(re.findall(r'<path (?!class=")', svg))] if n]
    points = [point for d in re.findall(r'\sd="([^"]+)"', svg) for point in path_points(d)]
    x0, y0, w, h = (float(n) for n in re.search(r'viewBox="([^"]+)"', svg)[1].split())
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    if min(xs) < x0 or max(xs) > x0 + w or min(ys) < y0 or max(ys) > y0 + h:
        problems.append(f'points reach x {min(xs):.1f}..{max(xs):.1f}, y {min(ys):.1f}..{max(ys):.1f}: outside the viewBox')
    print('\n'.join(problems) or 'check ok')
    return problems
