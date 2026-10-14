# Clipboard Monitoring and MIME Types in GNOME Shell (GNOME 45+)

## Overview

Clipboard operations in GNOME Shell operate across two distinct APIs within the Shell Compositor process:
1. **`Meta.Selection`** (`global.display.get_selection()`): The low-level Mutter selection subsystem. Provides direct access to Wayland/X11 selection ownership, raw MIME type negotiation, and asynchronous streaming via `Gio.OutputStream`.
2. **`St.Clipboard`** (`St.Clipboard.get_default()`): The high-level Shell Toolkit abstraction. Provides simpler callback-based text and binary data read/write methods.

For a robust clipboard manager, both are used together: `Meta.Selection` for tracking change events and inspecting available MIME types, and `St.Clipboard` / `Meta.SelectionSourceMemory` for reading and writing data.

---

## 1. Selection Types

GNOME Shell recognizes three primary selection types defined in `Meta.SelectionType` and `St.ClipboardType`:

| Selection Type | Mutter (`Meta.SelectionType`) | Clutter/St (`St.ClipboardType`) | Description |
|---|---|---|---|
| Standard Clipboard | `Meta.SelectionType.SELECTION_CLIPBOARD` | `St.ClipboardType.CLIPBOARD` | Standard `Ctrl+C` / `Ctrl+V` clipboard. |
| Primary Selection | `Meta.SelectionType.SELECTION_PRIMARY` | `St.ClipboardType.PRIMARY` | X11/Wayland mouse highlight selection (pasted via middle-click). |
| Drag & Drop | `Meta.SelectionType.SELECTION_DND` | N/A | Active drag-and-drop payload transfers. |

> **Best Practice:** When setting text or content programmatically, write to **both** `CLIPBOARD` and `PRIMARY` selections. This guarantees compatibility across traditional X11 apps, Wayland terminal emulators (e.g., Ptyxis, GNOME Terminal, Alacritty), and GUI text fields.

---

## 2. Monitoring Selection Changes (`owner-changed`)

The `owner-changed` signal on `Meta.Selection` is emitted whenever an application claims ownership of a selection.

```javascript
import Meta from 'gi://Meta';
import GLib from 'gi://GLib';

export class ClipboardMonitor {
    constructor(onChangedCallback) {
        this._onChangedCallback = onChangedCallback;
        this._selection = null;
        this._ownerChangedId = 0;
        this._transferring = false;
        this._debounceTimeoutId = 0;
        this._startTime = GLib.get_monotonic_time();
    }

    start() {
        this._selection = global.display.get_selection();
        this._startTime = GLib.get_monotonic_time();

        // Signal signature: (selection, selectionType, selectionSource)
        this._ownerChangedId = this._selection.connect(
            'owner-changed',
            (selection, selectionType, selectionSource) => {
                // Ignore spurious automatic startup signals within first 2 seconds of enabling
                const elapsedSeconds = (GLib.get_monotonic_time() - this._startTime) / GLib.USEC_PER_SEC;
                if (elapsedSeconds < 2.0) {
                    return;
                }

                if (selectionType === Meta.SelectionType.SELECTION_CLIPBOARD) {
                    this._handleOwnerChanged(selectionSource);
                }
            }
        );
    }

    _handleOwnerChanged(selectionSource) {
        // Prevent concurrent transfers and handle Wayland duplicate signals
        if (this._transferring) return;

        if (this._debounceTimeoutId) {
            GLib.source_remove(this._debounceTimeoutId);
        }

        // Debounce by 50ms to allow client window to finish writing all MIME targets
        this._debounceTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            this._debounceTimeoutId = 0;
            this._onChangedCallback(selectionSource);
            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {
        if (this._debounceTimeoutId) {
            GLib.source_remove(this._debounceTimeoutId);
            this._debounceTimeoutId = 0;
        }
        if (this._selection && this._ownerChangedId) {
            this._selection.disconnect(this._ownerChangedId);
            this._ownerChangedId = 0;
        }
        this._selection = null;
    }
}
```

### The Wayland Intermediate Stream Issue
On native Wayland sessions, Mutter uses an internal `GMemoryOutputStream` to bridge Wayland data-device transfers. This can trigger a second spurious `owner-changed` signal immediately after the first. 
* Always set a `this._transferring = true` lock during active transfers.
* Defer reading selection contents to a short `GLib.timeout_add` (40–100ms) or `GLib.idle_add` so Mutter's internal main-loop iterations complete before you query content.

---

## 3. Querying Available MIME Types

Before reading clipboard data, query the advertised MIME types to identify the format (plaintext, URI list, image, or secret password):

```javascript
import Meta from 'gi://Meta';
import St from 'gi://St';

/**
 * Get all advertised MIME types for the standard clipboard.
 * @returns {string[]} Array of MIME types (e.g., ['text/plain;charset=utf-8', 'image/png'])
 */
export function getAvailableMimeTypes() {
    const selection = global.display.get_selection();
    try {
        return selection.get_mimetypes(Meta.SelectionType.SELECTION_CLIPBOARD) || [];
    } catch {
        // Fallback to St.Clipboard
        return St.Clipboard.get_default().get_mimetypes(St.ClipboardType.CLIPBOARD) || [];
    }
}
```

Common MIME types encountered:
* Plaintext: `text/plain;charset=utf-8`, `text/plain`, `UTF8_STRING`, `STRING`
* Files / URIs: `text/uri-list`, `x-special/gnome-copied-files`
* Images: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
* HTML / Rich Text: `text/html`
* Sensitive Hints: `x-kde-passwordManagerHint`, `application/x-keepassxc-selection`

---

## 4. Reading Clipboard Data

### A. Reading Plaintext (Promise wrapper)
```javascript
import St from 'gi://St';

/**
 * Read text from standard clipboard.
 * @returns {Promise<string|null>} Resolves with trimmed string or null if empty.
 */
export function clipboardGetText() {
    return new Promise((resolve) => {
        St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_clip, text) => {
            resolve(text && text.trim().length > 0 ? text : null);
        });
    });
}
```

### B. Reading Binary / Custom MIME Types via `Meta.Selection.transfer_async`
`Meta.Selection.transfer_async` allows streaming arbitrary data for any MIME type directly into a `Gio.MemoryOutputStream`:

```javascript
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';

/**
 * Read raw bytes for a given MIME type asynchronously via Mutter.
 *
 * @param {string} mimeType The target MIME type (e.g. 'image/png' or 'text/uri-list')
 * @returns {Promise<Uint8Array|null>}
 */
export function readClipboardMimeBytes(mimeType) {
    return new Promise((resolve, reject) => {
        const selection = global.display.get_selection();
        const stream = Gio.MemoryOutputStream.new_resizable();

        selection.transfer_async(
            Meta.SelectionType.SELECTION_CLIPBOARD,
            mimeType,
            -1, // No size limit
            stream,
            null, // GCancellable
            (sel, res) => {
                try {
                    sel.transfer_finish(res);
                    const bytes = stream.steal_as_bytes();
                    if (bytes && bytes.get_size() > 0) {
                        resolve(bytes.get_data());
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}
```

### C. Reading via `St.Clipboard.get_content`
```javascript
import St from 'gi://St';

export function readClipboardContent(mimeType) {
    return new Promise((resolve) => {
        St.Clipboard.get_default().get_content(St.ClipboardType.CLIPBOARD, mimeType, (_clip, bytes) => {
            if (bytes && bytes.get_size() > 0) {
                resolve({ data: bytes.get_data(), size: bytes.get_size() });
            } else {
                resolve(null);
            }
        });
    });
}
```

---

## 5. Writing to the Clipboard

### A. Setting Plaintext
Always populate both `CLIPBOARD` and `PRIMARY`:

```javascript
import St from 'gi://St';

export function clipboardSetText(text) {
    const clipboard = St.Clipboard.get_default();
    clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    clipboard.set_text(St.ClipboardType.PRIMARY, text);
}
```

### B. Setting File URIs (`text/uri-list`)
File copies under Linux follow the `text/uri-list` RFC standard:
* Each file path must be formatted as a valid URI: `file:///home/user/document.pdf`.
* Lines **must** be terminated by CRLF (`\r\n`).

```javascript
import St from 'gi://St';
import GLib from 'gi://GLib';

/**
 * Set one or multiple file URIs onto the clipboard.
 * @param {string[]} fileUris Array of URIs, e.g. ['file:///home/user/pic.png']
 */
export function clipboardSetUriList(fileUris) {
    if (!fileUris || fileUris.length === 0) return;
    
    // Join with CRLF and append trailing CRLF
    const uriPayload = fileUris.join('\r\n') + '\r\n';
    const bytes = new TextEncoder().encode(uriPayload);
    const glibBytes = new GLib.Bytes(bytes);

    const clipboard = St.Clipboard.get_default();
    clipboard.set_content(St.ClipboardType.CLIPBOARD, 'text/uri-list', glibBytes);
    clipboard.set_content(St.ClipboardType.PRIMARY, 'text/uri-list', glibBytes);
}
```

### C. Setting Arbitrary Binary Data (e.g. Raw Image Bytes)
```javascript
import St from 'gi://St';
import GLib from 'gi://GLib';

/**
 * Set binary image data on clipboard.
 * @param {string} mimeType e.g. 'image/png'
 * @param {Uint8Array|GLib.Bytes} data
 */
export function clipboardSetImageBytes(mimeType, data) {
    const glibBytes = data instanceof GLib.Bytes ? data : new GLib.Bytes(data);
    const clipboard = St.Clipboard.get_default();
    clipboard.set_content(St.ClipboardType.CLIPBOARD, mimeType, glibBytes);
    clipboard.set_content(St.ClipboardType.PRIMARY, mimeType, glibBytes);
}
```

### D. Setting Owner Directly via `Meta.SelectionSourceMemory`
For advanced multi-target selection ownership in Mutter:
```javascript
import Meta from 'gi://Meta';
import GLib from 'gi://GLib';

export function setMemorySelectionOwner(mimeType, stringOrBytes) {
    const selection = global.display.get_selection();
    const bytes = typeof stringOrBytes === 'string' 
        ? new GLib.Bytes(new TextEncoder().encode(stringOrBytes))
        : (stringOrBytes instanceof GLib.Bytes ? stringOrBytes : new GLib.Bytes(stringOrBytes));

    const source = Meta.SelectionSourceMemory.new(mimeType, bytes);
    selection.set_owner(Meta.SelectionType.SELECTION_CLIPBOARD, source);
}
```

---

## 6. Avoiding the Infinite Feedback Loop

When an extension writes to the clipboard (e.g., user selects an item from history to copy it), `Meta.Selection` emits `owner-changed`. Without protection, the extension captures its own item again, causing duplicates and wasted disk I/O.

**Solution: The Hash Guard Pattern**
1. Compute a SHA-256 hash of the content before writing it to the clipboard.
2. Register this hash into a short-lived `Set` of known internal hashes.
3. In `_handleOwnerChanged()`, compute the hash of incoming clipboard data.
4. If the hash exists in the internal registry, suppress capture and remove the hash.
