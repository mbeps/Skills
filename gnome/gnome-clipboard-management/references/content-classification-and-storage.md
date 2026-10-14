# Content Classification, Storage, and Search Provider in GNOME Shell

## Overview

Clipboard managers handle diverse data types beyond plain text. A production extension must:
1. **Classify incoming clipboard content** using a strict priority pipeline (Image → File → URL → Contact → Color → Code → Text).
2. **Optimize storage persistence** by offloading large payloads to disk while keeping small items inline to prevent compositor lag and JSON parse bottlenecks.
3. **Ensure file integrity** via automatic healing when files are deleted or moved.
4. **Integrate with GNOME Shell's Overview Search** to allow users to search clipboard history, emojis, kaomojis, and symbols directly from the system search bar.

---

## 1. Content Classification Pipeline

When `owner-changed` fires and the content is cleared of security hints, the manager passes the data through an ordered pipeline of specialized processors.

### Priority Ordering Rationale
Because URLs, color codes, code snippets, and vCards can all be represented as plaintext, **specific formats must be evaluated before generic plaintext**.

```
[Raw Clipboard Event]
         │
         ▼
 1. Image Processor (MIME 'image/*') ──────────► [Image Item]
         │ (not image)
         ▼
 2. File Processor ('text/uri-list', 'file://')► [File Item]
         │ (not file)
         ▼
 3. URL / Web Link Processor ──────────────────► [URL Item + Favicon]
         │ (not URL)
         ▼
 4. Contact Processor (vCard, email, phone) ───► [Contact Item]
         │ (not contact)
         ▼
 5. Color Processor (HEX, RGB, HSL) ───────────► [Color Item + Swatch]
         │ (not color)
         ▼
 6. Code Processor (Syntax detection) ─────────► [Code Item + Highlighting]
         │ (not code)
         ▼
 7. Plain Text Processor (Fallback) ───────────► [Plain Text Item]
```

### Implementing the Pipeline

```javascript
import { ImageProcessor } from './processors/imageProcessor.js';
import { FileProcessor } from './processors/fileProcessor.js';
import { LinkProcessor } from './processors/linkProcessor.js';
import { ContactProcessor } from './processors/contactProcessor.js';
import { ColorProcessor } from './processors/colorProcessor.js';
import { CodeProcessor } from './processors/codeProcessor.js';
import { TextProcessor } from './processors/textProcessor.js';

export class ContentClassificationPipeline {
    constructor(options = {}) {
        this._imagesDir = options.imagesDir;
        this._previewsDir = options.previewsDir;
    }

    /**
     * Classifies raw clipboard content in priority order.
     *
     * @param {string[]} mimeTypes Available advertised MIME types.
     * @param {string|null} textContent Plaintext representation if available.
     * @returns {Promise<object|null>} Classified item metadata.
     */
    async classify(mimeTypes, textContent) {
        // 1. Binary Image check
        if (mimeTypes.some((m) => m.startsWith('image/'))) {
            const imageResult = await ImageProcessor.extract(mimeTypes, this._imagesDir, this._previewsDir);
            if (imageResult) return imageResult;
        }

        if (!textContent) return null;
        const cleanText = textContent.trim();
        if (cleanText.length === 0) return null;

        // 2. File URI check ('text/uri-list' or 'file://' string)
        if (mimeTypes.includes('text/uri-list') || cleanText.startsWith('file://') || cleanText.startsWith('/')) {
            const fileResult = await FileProcessor.process(cleanText);
            if (fileResult) return fileResult;
        }

        // 3. Web URL check
        const linkResult = LinkProcessor.process(cleanText);
        if (linkResult) return linkResult;

        // 4. Contact / vCard check
        const contactResult = ContactProcessor.process(cleanText);
        if (contactResult) return contactResult;

        // 5. Color check (HEX #ffffff, rgb(), hsl())
        const colorResult = ColorProcessor.process(cleanText);
        if (colorResult) return colorResult;

        // 6. Code check (programming keywords, braces, indentation)
        const codeResult = CodeProcessor.process(cleanText);
        if (codeResult) return codeResult;

        // 7. Generic Plaintext Fallback
        return TextProcessor.process(cleanText);
    }
}
```

---

## 2. Storage Architecture: Inline vs. Offloaded Payloads

In GNOME Shell, reading or writing large JSON files on the main compositor thread creates noticeable stutter and frame drops. Storing multi-megabyte clipboard items (such as large code files or CSV dumps) inside a single `history.json` is a fatal anti-pattern.

### Dual-Storage Strategy
* **Inline Storage (< 5 KB):** Short text, color codes, URLs, and item metadata are stored directly inside `history.json`.
* **Offloaded Storage (≥ 5 KB or Binary):** Large text files are saved to `~/.local/share/gnome-shell/extensions/<uuid>/storage/texts/<id>.txt`. Images are saved to `storage/images/<id>.png`. The `history.json` entry stores only a lightweight pointer (`text_filename: '<id>.txt'`).

```javascript
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const LARGE_TEXT_THRESHOLD_BYTES = 5 * 1024; // 5KB

export class ClipboardStorageManager {
    constructor(baseStorageDir) {
        this._baseDir = baseStorageDir;
        this._textsDir = GLib.build_filenamev([baseStorageDir, 'texts']);
        this._imagesDir = GLib.build_filenamev([baseStorageDir, 'images']);
        this._historyFile = GLib.build_filenamev([baseStorageDir, 'history.json']);

        this._ensureDirectories();
    }

    _ensureDirectories() {
        for (const dirPath of [this._textsDir, this._imagesDir]) {
            const dir = Gio.File.new_for_path(dirPath);
            if (!dir.query_exists(null)) {
                dir.make_directory_with_parents(null);
            }
        }
    }

    /**
     * Persist an item, offloading payload to disk if it exceeds threshold.
     */
    async persistItem(item) {
        if (item.type === 'text' || item.type === 'code') {
            const byteLength = new TextEncoder().encode(item.value).length;
            if (byteLength >= LARGE_TEXT_THRESHOLD_BYTES) {
                const filename = `${item.id}.txt`;
                const filePath = GLib.build_filenamev([this._textsDir, filename]);
                const file = Gio.File.new_for_path(filePath);

                // Write text asynchronously
                const stream = await file.replace_async(null, false, Gio.FileCreateFlags.NONE, GLib.PRIORITY_DEFAULT, null);
                await stream.write_bytes_async(new GLib.Bytes(new TextEncoder().encode(item.value)), GLib.PRIORITY_DEFAULT, null);
                await stream.close_async(GLib.PRIORITY_DEFAULT, null);

                // Replace inline value with pointer and preview snippet
                return {
                    ...item,
                    value: null, // Omit heavy payload from memory and history.json
                    text_filename: filename,
                    preview: item.value.slice(0, 200), // First 200 chars for list preview
                    byte_length: byteLength,
                };
            }
        }
        return item;
    }

    /**
     * Read the full value of an item, loading from disk if offloaded.
     */
    async loadFullItemValue(item) {
        if (item.value) return item.value;
        if (item.text_filename) {
            const filePath = GLib.build_filenamev([this._textsDir, item.text_filename]);
            const file = Gio.File.new_for_path(filePath);
            if (!file.query_exists(null)) return null;

            const [bytes] = await file.load_bytes_async(null);
            return new TextDecoder().decode(bytes.get_data());
        }
        return null;
    }
}
```

---

## 3. Data Integrity & File Healing

Files on disk can become desynchronized if the user deletes files from `storage/` or cleans the cache:
* If an offloaded text or image file is missing, the item is marked as `isCorrupted: true` so the UI can display a broken-file warning rather than crashing.
* For contact email favicons or web URL previews, a **healing routine** attempts to regenerate the icon asynchronously without discarding user history.

```javascript
export async function healHistoryItem(item, storageManager, linkProcessor) {
    // 1. Verify offloaded text
    if (item.text_filename) {
        const path = GLib.build_filenamev([storageManager.textsDir, item.text_filename]);
        if (!Gio.File.new_for_path(path).query_exists(null)) {
            return { ...item, isCorrupted: true };
        }
    }

    // 2. Heal missing link or email favicon
    if (item.icon_filename && (item.type === 'url' || item.subtype === 'email')) {
        const iconPath = GLib.build_filenamev([storageManager.linkPreviewsDir, item.icon_filename]);
        if (!Gio.File.new_for_path(iconPath).query_exists(null)) {
            const newIcon = await linkProcessor.regenerateIcon(item);
            return { ...item, icon_filename: newIcon };
        }
    }

    return item;
}
```

---

## 4. GNOME Shell Search Provider Integration

GNOME Shell allows extensions to register custom search providers in the Activities Overview (`Main.overview.searchController`). When the user types in the overview, the extension provides matching clipboard items or emojis.

```javascript
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Gio from 'gi://Gio';

export class ClipboardSearchProvider {
    constructor(clipboardManager, extension) {
        this._manager = clipboardManager;
        this._extension = extension;
        this.id = 'clipboard-history';
        this.title = 'Clipboard';
        this.isRemoteProvider = false;
        this.canLaunchSearch = false;
    }

    /**
     * Filter items matching query terms.
     */
    getInitialResultSet(terms, cancellable) {
        const query = terms.join(' ').toLowerCase();
        const items = this._manager.getAllItems();
        
        const matchedIds = items
            .filter((item) => {
                const preview = (item.preview || item.value || '').toLowerCase();
                return preview.includes(query);
            })
            .slice(0, 10) // Limit overview results
            .map((item) => item.id);

        return Promise.resolve(matchedIds);
    }

    getSubsearchResultSet(previousResults, terms, cancellable) {
        return this.getInitialResultSet(terms, cancellable);
    }

    /**
     * Generate metadata for overview search result tiles.
     */
    getResultMetas(resultIds, cancellable) {
        const metas = resultIds.map((id) => {
            const item = this._manager.getItemById(id);
            return {
                id,
                name: (item.preview || item.value || 'Clipboard Item').slice(0, 60),
                description: `Copied ${new Date(item.timestamp * 1000).toLocaleTimeString()}`,
                createIcon: (size) => new St.Icon({
                    icon_name: item.type === 'image' ? 'image-x-generic-symbolic' : 'edit-paste-symbolic',
                    icon_size: size,
                }),
            };
        });
        return Promise.resolve(metas);
    }

    /**
     * Called when the user clicks or presses Enter on a search result.
     */
    activateResult(id, terms) {
        const item = this._manager.getItemById(id);
        if (item) {
            this._manager.copyItemToClipboard(item);
        }
    }

    filterResults(results, maxResults) {
        return results.slice(0, maxResults);
    }
}

// Registration in Extension.enable():
export function registerOverviewProvider(provider) {
    Main.overview.searchController.addProvider(provider);
}

// Unregistration in Extension.disable():
export function unregisterOverviewProvider(provider) {
    Main.overview.searchController.removeProvider(provider);
}
```
