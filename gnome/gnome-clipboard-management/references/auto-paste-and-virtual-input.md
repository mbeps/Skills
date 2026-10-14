# Auto-Paste and Virtual Keystroke Injection in GNOME Shell

## Overview

Auto-paste allows a clipboard extension to immediately paste a selected item into the currently active application without requiring the user to manually press `Ctrl+V`.

In GNOME Shell (GNOME 45+), this is achieved by creating a virtual keyboard device through Mutter's Clutter backend seat:
```javascript
const seat = global.stage.context.get_backend().get_default_seat();
const virtualKeyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
```

However, executing virtual keystrokes safely requires managing modal grabs, stage focus, and compositor timing across Wayland and X11.

---

## 1. The Clutter Modal Grab & Focus Trap

When an extension panel menu (`PanelMenu.Button.menu`) or modal dialog is open:
1. Clutter maintains an exclusive input grab.
2. The Shell stage holds key focus (`global.stage.get_key_focus()`).
3. If virtual keystrokes are emitted while the menu is closing or while stage focus is held, the keystrokes are delivered to the closing menu actor (and ignored) rather than to the user's active application window.

### The Correct Sequence
To reliably paste into the client window:
1. **Copy** content to the clipboard (`St.Clipboard` / `Meta.Selection`).
2. **Close** the popup menu (`menu.close()`) to release the Clutter grab.
3. **Clear** key focus on stage (`global.stage.set_key_focus(null)`).
4. **Delay** virtual keystrokes by 50–100ms using `GLib.timeout_add` to allow the compositor to refocus the underlying client window.
5. **Inject** the paste keystrokes via the virtual keyboard device.

---

## 2. Choosing the Paste Shortcut: Terminal Detection & Trade-offs

GNOME Shell exposes the input purpose of the focused client window via `Main.inputMethod.contentPurpose`.

| Context | Shortcut | Implementation | Why |
|---|---|---|---|
| **Terminal Context** (`contentPurpose === TERMINAL`) | `Ctrl + Shift + V` or `Shift + Insert` | Scancodes 42 + 110 or Keysyms `Ctrl_L` + `Shift_L` + `v` | Standard `Ctrl + V` sends SIGINT or literal `^V` in terminals. |
| **Standard GUI Context** | `Ctrl + V` or `Shift + Insert` | Scancodes 42 + 110 or Keysyms `Ctrl_L` + `v` | Works across browsers, office suites, and chat apps. |

---

## 3. Scancodes vs. Keysyms & Modifier Safety

### A. Scancodes (`notify_key` with Evdev codes)
Physical key positions independent of keyboard layout:
* `KEY_LEFTSHIFT` = 42
* `KEY_INSERT` = 110

### B. Keysyms (`notify_keyval` with Clutter keysyms)
Symbolic representations:
* `Clutter.KEY_Control_L`, `Clutter.KEY_Shift_L`, `Clutter.KEY_v`

### ⚠️ Critical Rule: The `finally` Release Guarantee
If an unhandled exception or compositor interruption occurs between key `PRESSED` and `RELEASED`, the modifier key remains locked down in Mutter's seat state. The user's physical keyboard then types in ALL CAPS (stuck Shift) or executes keyboard shortcuts on every letter (stuck Ctrl). **All virtual key press sequences MUST guarantee release in a `finally` block.**

---

## 4. Production-Ready AutoPaster Implementation

```javascript
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Evdev Scancodes
const KEY_LEFTSHIFT = 42;
const KEY_INSERT = 110;

export class AutoPaster {
    constructor() {
        this._virtualKeyboard = null;
        this._pasteTimeoutId = 0;
    }

    /**
     * Lazy instantiation of Mutter virtual keyboard device.
     */
    _getVirtualKeyboard() {
        if (!this._virtualKeyboard) {
            const seat = global.stage.context.get_backend().get_default_seat();
            this._virtualKeyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        }
        return this._virtualKeyboard;
    }

    /**
     * Safely executes copy and delayed keystroke injection.
     *
     * @param {object} options
     * @param {Function} options.copyFn Clipboard writing callback.
     * @param {PopupMenu.PopupMenu} [options.menu] Menu to close before pasting.
     * @param {number} [options.delayMs=50] Focus recovery delay.
     * @param {'auto'|'shift_insert'|'ctrl_v'} [options.mode='auto'] Paste strategy.
     * @returns {Promise<boolean>}
     */
    async paste({ copyFn, menu = null, delayMs = 50, mode = 'auto' }) {
        if (copyFn) {
            const success = await copyFn();
            if (!success) return false;
        }

        // 1. Close menu to release Clutter modal grab
        if (menu && menu.isOpen) {
            menu.close();
        }

        // 2. Clear stage key focus so the active client window regains focus
        const currentFocus = global.stage.get_key_focus();
        if (currentFocus) {
            global.stage.set_key_focus(null);
        }

        // 3. Dispatch keystrokes after compositor focus transition
        return new Promise((resolve) => {
            if (this._pasteTimeoutId) {
                GLib.source_remove(this._pasteTimeoutId);
            }

            this._pasteTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
                this._pasteTimeoutId = 0;
                this._injectPasteKeystrokes(mode);
                resolve(true);
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    /**
     * Injects keystrokes with guaranteed modifier release.
     */
    _injectPasteKeystrokes(mode) {
        const keyboard = this._getVirtualKeyboard();
        const isTerminal = Main.inputMethod.contentPurpose === Clutter.InputContentPurpose.TERMINAL;

        if (mode === 'shift_insert' || (mode === 'auto' && !isTerminal)) {
            // Option 1: Universal Shift + Insert via Evdev scancodes
            const now = GLib.get_monotonic_time();
            try {
                keyboard.notify_key(now, KEY_LEFTSHIFT, Clutter.KeyState.PRESSED);
                keyboard.notify_key(now + 10, KEY_INSERT, Clutter.KeyState.PRESSED);
                keyboard.notify_key(now + 20, KEY_INSERT, Clutter.KeyState.RELEASED);
            } finally {
                // Guaranteed Shift release
                keyboard.notify_key(now + 30, KEY_LEFTSHIFT, Clutter.KeyState.RELEASED);
            }
        } else if (isTerminal) {
            // Option 2: Terminal Ctrl + Shift + V via Clutter keysyms
            const time = Clutter.get_current_event_time();
            try {
                keyboard.notify_keyval(time, Clutter.KEY_Control_L, Clutter.KeyState.PRESSED);
                keyboard.notify_keyval(time, Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED);
                keyboard.notify_keyval(time + 10, Clutter.KEY_v, Clutter.KeyState.PRESSED);
                keyboard.notify_keyval(time + 20, Clutter.KEY_v, Clutter.KeyState.RELEASED);
            } finally {
                keyboard.notify_keyval(time + 30, Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED);
                keyboard.notify_keyval(time + 40, Clutter.KEY_Control_L, Clutter.KeyState.RELEASED);
            }
        } else {
            // Option 3: Standard Ctrl + V via Clutter keysyms
            const time = Clutter.get_current_event_time();
            try {
                keyboard.notify_keyval(time, Clutter.KEY_Control_L, Clutter.KeyState.PRESSED);
                keyboard.notify_keyval(time + 10, Clutter.KEY_v, Clutter.KeyState.PRESSED);
                keyboard.notify_keyval(time + 20, Clutter.KEY_v, Clutter.KeyState.RELEASED);
            } finally {
                keyboard.notify_keyval(time + 30, Clutter.KEY_Control_L, Clutter.KeyState.RELEASED);
            }
        }
    }

    destroy() {
        if (this._pasteTimeoutId) {
            GLib.source_remove(this._pasteTimeoutId);
            this._pasteTimeoutId = 0;
        }
        this._virtualKeyboard = null;
    }
}
```

---

## 5. Common Pitfalls & Edge Cases

1. **Stuck Shift Key:**
   If `KEY_LEFTSHIFT` is pressed but not released (e.g. an exception throws between `PRESSED` and `RELEASED`), the user's keyboard state becomes corrupted, causing subsequent typing to be uppercase. Always wrap `notify_key` calls in a `try...catch` or emit release calls safely.

2. **Pasting too fast on Wayland:**
   If `delayMs` is 0 or 10ms, the compositor might still be performing the fade-out animation of the popup menu. `50ms` is optimal; if testing on high-latency systems or heavy graphics loads, `100ms` provides maximum reliability.

3. **Multi-monitor and Focus Switching:**
   Before auto-pasting, verify that `global.display.focus_window` exists. If the user clicks outside onto the desktop background before auto-paste fires, no window will receive the keystroke.
