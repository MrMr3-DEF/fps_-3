/** Archive of the design review. Approved C is also a production HUD asset. */
export function showStompIconPreview(): void {
    document.title = 'Mecha stomp — pictogram review';
    document.documentElement.style.overflow = 'auto';
    document.body.style.cssText = 'margin:0;min-height:100vh;height:auto;overflow:auto;background:linear-gradient(#55afe0,#b7e4f7);color:#123044';
    const source = document.getElementById('weapon-indicator');
    if (!source) throw new Error('The production weapon-indicator sample is missing.');
    const style = getComputedStyle(source);
    const chrome = { boxSizing: style.boxSizing, border: style.border, borderRadius: style.borderRadius,
        background: style.background, boxShadow: style.boxShadow, color: style.color };
    const sheet = document.createElement('style');
    sheet.textContent = `
        .stomp-review { box-sizing:border-box; width:min(1100px,100%); margin:0 auto; padding:40px 28px; }
        .stomp-review h1 { font-size:30px; margin:6px 0 10px; letter-spacing:-.7px; }
        .stomp-review p { margin:0; line-height:1.6; font-size:14px; }
        .stomp-review-eyebrow { font-size:11px; font-weight:700; letter-spacing:2px; }
        .stomp-review-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; margin:30px 0 22px; }
        .stomp-review-card { padding:24px; border:1px solid #ffffff80; border-radius:var(--control-radius); background:#eaf6ff66; }
        .stomp-review-card h2 { margin:0 0 8px; font-size:19px; }
        .stomp-review-card p { min-height:68px; font-size:12px; }
        .stomp-review-label { display:block; font-size:11px; margin:20px 0 8px; opacity:.8; }
        .stomp-review-sample { flex:none; }
        .stomp-review-sample img { display:block; width:100%; height:100%; object-fit:contain; }
        .stomp-review-note { padding:16px 0; border-top:1px solid #ffffff80; }
        @media(max-width:800px) { .stomp-review {padding:26px 20px;} .stomp-review-grid {grid-template-columns:1fr;} .stomp-review-card p {min-height:0;} }
    `;
    document.head.append(sheet);
    const main = document.createElement('main');
    main.className = 'stomp-review';
    main.innerHTML = '<div class="stomp-review-eyebrow">MECHA STOMP · DESIGN ROUND 2</div>' +
        '<h1>Approved: C · Impact burst</h1>' +
        '<p>The actual robot foot, facing right. Three static white treatments, shown at both HUD sizes.</p>';
    const grid = document.createElement('div'); grid.className = 'stomp-review-grid';
    for (const [variant, title, description] of [
        ['A', 'Motion streaks', 'Short descending streaks above the ankle, with a restrained impact underneath.'],
        ['B', 'Downward chevrons', 'Two clear downward cues above the foot, with a clean ground line below.'],
        ['C', 'Impact burst', 'A stronger fan of impact rays beneath the sole. The lone line above the foot has been removed.'],
    ]) {
        const card = document.createElement('article'); card.className = 'stomp-review-card'; card.dataset.variant = variant;
        const heading = document.createElement('h2'); heading.textContent = `${variant} · ${title}`;
        const text = document.createElement('p'); text.textContent = description;
        card.append(heading, text);
        for (const [size, width, height, padding] of [['Desktop', 140, 70, 8], ['Mobile', 88, 44, 4]] as const) {
            const label = document.createElement('span'); label.className = 'stomp-review-label';
            label.textContent = `${size} · ${width} × ${height}px`;
            const sample = document.createElement('div'); sample.className = 'stomp-review-sample'; sample.dataset.size = size;
            Object.assign(sample.style, chrome, { width: `${width}px`, height: `${height}px`, padding: `${padding}px` });
            const image = document.createElement('img'); image.src = `/tests/fixtures/stomp-icons/${variant}.svg`;
            image.alt = `Stomp pictogram ${variant}, ${size.toLowerCase()} size`;
            sample.append(image); card.append(label, sample);
        }
        grid.append(card);
    }
    const note = document.createElement('p'); note.className = 'stomp-review-note';
    note.textContent = 'Approved design: C, with impact rays beneath the sole and no upper line. This pictogram is used for the playable stomp.';
    main.append(grid, note); document.body.append(main);
}
