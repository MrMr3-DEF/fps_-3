const SVG_NS = 'http://www.w3.org/2000/svg';

/** The two scan templates share the CSS animation definitions in gameUI.css. */
export function createCornerScan(root: HTMLElement): [HTMLDivElement, HTMLDivElement, HTMLDivElement, HTMLDivElement] {
    return (['tl', 'tr', 'bl', 'br'] as const).map(name => {
        const corner = document.createElement('div');
        corner.className = `goggles-target-corner goggles-target-corner--${name}`;
        root.appendChild(corner);
        return corner;
    }) as [HTMLDivElement, HTMLDivElement, HTMLDivElement, HTMLDivElement];
}

export function createInfoOverview(root: HTMLElement) {
    const leader = document.createElementNS(SVG_NS, 'svg');
    leader.classList.add('goggles-target-leader');
    leader.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('pathLength', '1');
    leader.appendChild(path);
    const label = document.createElement('div');
    label.className = 'goggles-target-label';
    const identifier = document.createElement('span');
    identifier.className = 'goggles-target-identifier';
    const panel = document.createElement('div');
    panel.className = 'goggles-target-label-panel';
    label.append(identifier, panel);
    root.append(leader, label);
    return { path, label, identifier, panel };
}

const writtenValues = new WeakMap<Element, Map<string, string>>();

function changed(element: Element, key: string, value: string): boolean {
    let values = writtenValues.get(element);
    if (!values) { values = new Map(); writtenValues.set(element, values); }
    if (values.get(key) === value) return false;
    values.set(key, value);
    return true;
}

/** Keep live projection without submitting identical geometry to the DOM. */
export function setScanStyle(element: HTMLElement | SVGElement, property: string, value: string): void {
    if (!changed(element, `style:${property}`, value)) return;
    if (property.startsWith('--')) element.style.setProperty(property, value);
    else (element.style as unknown as Record<string, string>)[property] = value;
}

export function setScanAttribute(element: Element, name: string, value: string): void {
    if (changed(element, `attribute:${name}`, value)) element.setAttribute(name, value);
}
