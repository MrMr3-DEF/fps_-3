import { cloneTouchLayout, getTouchControlRect, placeTouchControl, MIN_TOUCH_SCALE, MAX_TOUCH_SCALE, type TouchControlId, type TouchLayout, type TouchFireMode } from './mobileControlLayout.js';
import { createTouchControls, applyTouchLayout, getTouchBounds } from './mobileControlsView.js';

export class MobileControlsEditor {
    isOpen = false;

    open(savedLayout: TouchLayout, savedFireMode: TouchFireMode, onSave: (layout: TouchLayout, fireMode: TouchFireMode) => void): void {
        if (this.isOpen) return;
        this.isOpen = true;
        // This preview owns DOM only. It cannot acquire game input, load a world,
        // dispatch action codes, or mutate the paused match's camera/state.
        const draft = cloneTouchLayout(savedLayout);
        let draftFireMode = savedFireMode;
        const lifetime = new AbortController();
        const options = { signal: lifetime.signal };
        const previousFocus = document.activeElement as HTMLElement | null;
        const root = document.createElement('dialog');
        root.className = 'touch-controls-editor';
        root.setAttribute('aria-label', 'Edit touch controls');
        root.innerHTML = `
            <header class="touch-editor-toolbar">
                <strong>Edit controls</strong>
                <div class="menu-actions">
                    <button type="button" class="menu-btn secondary" data-exit>Exit</button>
                    <button type="button" class="menu-btn" data-save>Save</button>
                </div>
            </header>
            <p class="touch-editor-help">Drag controls to move them. Select one to resize. Tap the sky to deselect.</p>
            <div class="touch-editor-size settings-container" hidden>
                <label for="touch-control-size"></label><output for="touch-control-size"></output>
                <input id="touch-control-size" type="range" min="${MIN_TOUCH_SCALE * 100}" max="${MAX_TOUCH_SCALE * 100}" step="5" value="100">
                <div class="mobile-input-options touch-editor-fire-mode" role="group" aria-label="Fire control type" hidden>
                    <button type="button" class="menu-btn secondary" data-fire-mode="joystick">Joystick</button>
                    <button type="button" class="menu-btn secondary" data-fire-mode="button">Button</button>
                </div>
            </div>
            <div class="touch-editor-rotate"><strong>Rotate your device</strong><p>Hold your phone in landscape to edit controls.</p></div>`;
        const layer = createTouchControls(draftFireMode);
        layer.classList.add('touch-controls-preview');
        root.prepend(layer);
        const sizePanel = root.querySelector<HTMLElement>('.touch-editor-size')!;
        const sizeLabel = sizePanel.querySelector('label')!;
        const sizeValue = sizePanel.querySelector('output')!;
        const slider = sizePanel.querySelector('input')!;
        const fireTypeOptions = sizePanel.querySelector<HTMLElement>('.touch-editor-fire-mode')!;
        const exit = root.querySelector<HTMLButtonElement>('[data-exit]')!;
        const save = root.querySelector<HTMLButtonElement>('[data-save]')!;
        const confirm = document.createElement('dialog');
        confirm.className = 'touch-editor-confirm';
        confirm.setAttribute('aria-labelledby', 'touch-editor-confirm-title');
        confirm.innerHTML = `
            <h2 id="touch-editor-confirm-title">Are you sure you want to leave without saving?</h2>
            <div class="menu-actions">
                <button type="button" class="menu-btn" data-back>Go back</button>
                <button type="button" class="menu-btn secondary" data-leave>Leave</button>
            </div>`;
        document.body.append(root, confirm);
        let selected: HTMLElement | null = null;
        let drag: { pointer: number; id: TouchControlId; offsetX: number; offsetY: number } | null = null;

        const positionSlider = () => {
            if (!selected) return;
            const id = selected.dataset.control as TouchControlId;
            const bounds = getTouchBounds(layer);
            const rect = getTouchControlRect(id, draft, bounds, draftFireMode);
            const width = Math.min(220, bounds.width - bounds.left - bounds.right - 16);
            sizePanel.style.width = `${width}px`;
            sizePanel.style.left = `${Math.max(bounds.left + 8, Math.min(bounds.width - bounds.right - width - 8, rect.left + (rect.width - width) / 2))}px`;
            // Place it above the selected control; the upper edge uses the space
            // below instead, keeping top-row controls and the slider reachable.
            const above = rect.top - sizePanel.offsetHeight - 10;
            const top = above >= bounds.top + 8 ? above : rect.top + rect.height + 10;
            sizePanel.style.top = `${Math.max(bounds.top + 8, Math.min(bounds.height - bounds.bottom - sizePanel.offsetHeight - 8, top))}px`;
        };
        const render = () => {
            applyTouchLayout(layer, draft, draftFireMode);
            fireTypeOptions.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.fireMode === draftFireMode));
            });
            positionSlider();
        };
        const releaseDrag = () => {
            if (!drag || !selected) return;
            const pointer = drag.pointer;
            drag = null;
            if (selected.hasPointerCapture(pointer)) selected.releasePointerCapture(pointer);
        };
        const close = () => {
            releaseDrag();
            lifetime.abort();
            confirm.close();
            root.close();
            confirm.remove();
            root.remove();
            this.isOpen = false;
            previousFocus?.focus();
        };
        const requestExit = () => {
            releaseDrag();
            if (!confirm.open) confirm.showModal();
        };
        const goBack = () => { confirm.close(); exit.focus(); };
        layer.querySelector('.touch-look')!.addEventListener('click', () => {
            if (drag) return;
            selected?.classList.remove('is-selected');
            selected?.setAttribute('aria-pressed', 'false');
            selected = null;
            sizePanel.hidden = true;
        }, options);
        exit.addEventListener('click', requestExit, options);
        save.addEventListener('click', () => { onSave(cloneTouchLayout(draft), draftFireMode); close(); }, options);
        for (const button of fireTypeOptions.querySelectorAll<HTMLButtonElement>('button')) {
            button.addEventListener('click', () => {
                releaseDrag();
                const bounds = getTouchBounds(layer);
                const rect = getTouchControlRect('fire', draft, bounds, draftFireMode);
                draftFireMode = button.dataset.fireMode as TouchFireMode;
                // Changing shape preserves the selected control's center and
                // scale, subject to the same safe-area clamp as a resize.
                placeTouchControl('fire', draft, bounds, rect.left + rect.width / 2, rect.top + rect.height / 2, draft.fire?.scale ?? 1, draftFireMode);
                render();
                sizeLabel.textContent = `${selected!.getAttribute('aria-label')} size`;
            }, options);
        }
        confirm.querySelector('[data-back]')!.addEventListener('click', goBack, options);
        confirm.querySelector('[data-leave]')!.addEventListener('click', close, options);
        confirm.addEventListener('cancel', event => { event.preventDefault(); goBack(); }, options);
        root.addEventListener('cancel', event => { event.preventDefault(); requestExit(); }, options);
        window.addEventListener('keydown', event => {
            // Window gameplay handlers still exist behind a modal. Keep Escape
            // from also activating Settings > Back or resuming a paused match.
            if (event.code === 'Escape') {
                event.stopImmediatePropagation();
                event.preventDefault();
                if (event.repeat) return;
                if (confirm.open) goBack();
                else requestExit();
            }
        }, { ...options, capture: true });
        for (const modal of [root, confirm]) {
            modal.addEventListener('keydown', event => event.stopPropagation(), options);
            modal.addEventListener('keyup', event => event.stopPropagation(), options);
        }
        for (const element of layer.querySelectorAll<HTMLElement>('[data-control]')) {
            if (element.classList.contains('touch-stick')) { element.tabIndex = 0; element.setAttribute('role', 'button'); }
            const select = () => {
                selected?.classList.remove('is-selected');
                selected?.setAttribute('aria-pressed', 'false');
                selected = element;
                selected.classList.add('is-selected');
                selected.setAttribute('aria-pressed', 'true');
                const scale = draft[element.dataset.control as TouchControlId]?.scale ?? 1;
                sizeLabel.textContent = `${element.getAttribute('aria-label')} size`;
                slider.value = String(Math.round(scale * 100));
                sizeValue.value = `${slider.value}%`;
                sizePanel.hidden = false;
                fireTypeOptions.hidden = element.dataset.control !== 'fire';
                positionSlider();
            };
            element.addEventListener('click', () => { if (!drag) select(); }, options);
            if (element.classList.contains('touch-stick')) {
                element.addEventListener('keydown', event => {
                    if (event.code !== 'Enter' && event.code !== 'Space') return;
                    event.preventDefault();
                    select();
                }, options);
            }
            element.addEventListener('pointerdown', event => {
                if (drag || event.button !== 0) return;
                event.preventDefault();
                select();
                const id = element.dataset.control as TouchControlId;
                const rect = getTouchControlRect(id, draft, getTouchBounds(layer), draftFireMode);
                drag = { pointer: event.pointerId, id, offsetX: event.clientX - rect.left - rect.width / 2, offsetY: event.clientY - rect.top - rect.height / 2 };
                element.setPointerCapture(event.pointerId);
            }, options);
            element.addEventListener('pointermove', event => {
                if (!drag || event.pointerId !== drag.pointer) return;
                placeTouchControl(drag.id, draft, getTouchBounds(layer), event.clientX - drag.offsetX, event.clientY - drag.offsetY, draft[drag.id]?.scale ?? 1, draftFireMode);
                render();
            }, options);
            for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
                element.addEventListener(event, event => { if ((event as PointerEvent).pointerId === drag?.pointer) releaseDrag(); }, options);
            }
        }
        slider.addEventListener('input', () => {
            if (!selected) return;
            const id = selected.dataset.control as TouchControlId;
            const bounds = getTouchBounds(layer);
            const rect = getTouchControlRect(id, draft, bounds, draftFireMode);
            placeTouchControl(id, draft, bounds, rect.left + rect.width / 2, rect.top + rect.height / 2, Number(slider.value) / 100, draftFireMode);
            sizeValue.value = `${slider.value}%`;
            render();
        }, options);
        window.addEventListener('resize', () => { releaseDrag(); render(); }, options);
        window.addEventListener('blur', releaseDrag, options);
        document.addEventListener('visibilitychange', releaseDrag, options);
        root.showModal();
        render();
        exit.focus();
    }
}
