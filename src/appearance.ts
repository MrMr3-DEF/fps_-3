const KEY = 'testfps-character-color';
export function validCharacterColor(value: unknown): value is string {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}
export let characterColor = '#3b5998';
try { const saved = localStorage.getItem(KEY); if (validCharacterColor(saved)) characterColor = saved; } catch { /* Storage is optional. */ }
export function saveCharacterColor(color: string): void {
    if (!validCharacterColor(color)) return;
    characterColor = color;
    try { localStorage.setItem(KEY, color); } catch { /* Keep the current session color. */ }
}
