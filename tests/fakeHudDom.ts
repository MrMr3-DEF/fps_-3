/** Minimal DOM surface used by the real goggles overlay in simulation tests. */
export class HudElement {
    children: HudElement[] = [];
    parent: HudElement | null = null;
    textContent = '';
    className = '';
    hidden = false;
    dataset: Record<string, string> = {};
    style = { setProperty() {} };
    clientWidth = 1280;
    clientHeight = 720;
    private classes = new Set<string>();
    classList = {
        add: (...names: string[]) => names.forEach(name => this.classes.add(name)),
        remove: (...names: string[]) => names.forEach(name => this.classes.delete(name)),
        contains: (name: string) => this.classes.has(name),
        toggle: (name: string, value: boolean) => value ? this.classes.add(name) : this.classes.delete(name),
    };
    setAttribute() {}
    getContext() { return null; }
    appendChild(child: HudElement) { child.parent = this; this.children.push(child); }
    append(...children: HudElement[]) { children.forEach(child => this.appendChild(child)); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    texts(): string[] { return [this.textContent, ...this.children.flatMap(child => child.texts())]; }
}
