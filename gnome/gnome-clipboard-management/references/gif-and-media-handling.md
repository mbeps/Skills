# GIF and Rich Media Handling in GNOME Shell Extensions

## Overview

Supporting animated GIFs and media within a GNOME Shell clipboard extension introduces two primary challenges:
1. **Network I/O in the Compositor:** Network requests must be non-blocking. Blocking the main loop in `gnome-shell` freezes the entire desktop interface.
2. **Dual Paste Strategy:** Chat applications (Slack, Discord) prefer direct URLs that unfurl into animations, whereas document editors (LibreOffice, GIMP) require raw file URIs (`text/uri-list`) or raw image bytes.

---

## 1. Asynchronous Fetching with libsoup 3.0

GNOME 45+ uses `Soup 3.0` for all HTTP networking. The legacy `session.queue()` and `Soup 2.4` APIs are deprecated and forbidden.

```javascript
import Soup from 'gi://Soup?version=3.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class MediaHttpService {
    constructor() {
        this._session = new Soup.Session();
        this._session.timeout = 10; // 10 second timeout
    }

    /**
     * Download binary data asynchronously from a URL.
     *
     * @param {string} url The image or GIF URL.
     * @returns {Promise<Uint8Array|null>} Downloaded bytes or null on failure.
     */
    downloadBytes(url) {
        return new Promise((resolve) => {
            try {
                const uri = GLib.Uri.parse(url, GLib.UriFlags.NONE);
                const message = new Soup.Message({
                    method: 'GET',
                    uri,
                });

                this._session.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null, // GCancellable
                    (session, res) => {
                        try {
                            const bytes = session.send_and_read_finish(res);
                            if (message.get_status() === Soup.Status.OK && bytes) {
                                resolve(bytes.get_data());
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            console.error(`Download failed: ${e.message}`);
                            resolve(null);
                        }
                    }
                );
            } catch (e) {
                console.error(`Invalid URI: ${e.message}`);
                resolve(null);
            }
        });
    }

    destroy() {
        this._session.abort();
        this._session = null;
    }
}
```

---

## 2. Magic Byte Header Verification

Never trust the HTTP `Content-Type` header or file extension alone. Verify magic byte signatures before parsing or persisting media:

```javascript
const MIN_HEADER_SIZE = 4;

const MAGIC_PNG  = [0x89, 0x50, 0x4E, 0x47]; // .PNG
const MAGIC_JPEG = [0xFF, 0xD8, 0xFF];       // JPEG
const MAGIC_GIF  = [0x47, 0x49, 0x46];       // GIF
const MAGIC_WEBP = [0x52, 0x49, 0x46, 0x46]; // RIFF (WebP)

export function isValidImageBytes(bytes, expectedMime) {
    if (!bytes || bytes.length < MIN_HEADER_SIZE) return false;

    switch (expectedMime) {
        case 'image/png':
            return MAGIC_PNG.every((b, i) => bytes[i] === b);
        case 'image/jpeg':
        case 'image/jpg':
            return MAGIC_JPEG.every((b, i) => bytes[i] === b);
        case 'image/gif':
            return MAGIC_GIF.every((b, i) => bytes[i] === b);
        case 'image/webp':
            return MAGIC_WEBP.every((b, i) => bytes[i] === b);
        default:
            return false;
    }
}
```

---

## 3. Dual Paste Implementation (URL vs. File-Backed Image)

Allow users to configure whether GIFs are copied as links or as downloaded files:

```javascript
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

/**
 * Copy GIF based on user preference: Link vs. Downloaded File.
 *
 * @param {object} gif GIF metadata object (contains full_url).
 * @param {number} mode 0 = Link Mode, 1 = File Mode
 * @param {string} cacheDir Directory to save files.
 * @param {MediaHttpService} httpService
 */
export async function copyGif(gif, mode, cacheDir, httpService) {
    // Mode 0: Link Mode (Copy URL text directly)
    if (mode === 0) {
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, gif.full_url);
        clipboard.set_text(St.ClipboardType.PRIMARY, gif.full_url);
        return true;
    }

    // Mode 1: File Mode (Download & copy file URI list)
    const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, gif.full_url, -1);
    const filename = `${hash}.gif`;
    const destPath = GLib.build_filenamev([cacheDir, filename]);
    const file = Gio.File.new_for_path(destPath);

    // Download if not already cached
    if (!file.query_exists(null)) {
        const bytes = await httpService.downloadBytes(gif.full_url);
        if (!bytes) return false;

        const outStream = await file.replace_async(null, false, Gio.FileCreateFlags.NONE, GLib.PRIORITY_DEFAULT, null);
        await outStream.write_bytes_async(new GLib.Bytes(bytes), GLib.PRIORITY_DEFAULT, null);
        await outStream.close_async(GLib.PRIORITY_DEFAULT, null);
    }

    // Set clipboard as 'text/uri-list'
    const uriPayload = `${file.get_uri()}\r\n`;
    const uriBytes = new GLib.Bytes(new TextEncoder().encode(uriPayload));

    const clipboard = St.Clipboard.get_default();
    clipboard.set_content(St.ClipboardType.CLIPBOARD, 'text/uri-list', uriBytes);
    clipboard.set_content(St.ClipboardType.PRIMARY, 'text/uri-list', uriBytes);

    return true;
}
```

---

## 4. True Asynchronous Thumbnail Generation and Disk Caching

Displaying full-resolution GIFs and images in St UI widgets quickly exhausts memory and causes stutters. Decoding and scaling large images synchronously on the compositor thread (even inside `GLib.idle_add`) causes frame drops and UI freezes.

Always decode and scale asynchronously using GIO input streams and `GdkPixbuf.Pixbuf.new_from_stream_at_scale_async`:

```javascript
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const PREVIEW_MAX_PX = 160;

/**
 * Generate a cached PNG thumbnail from a source image asynchronously without blocking compositor.
 *
 * @param {string} sourcePath Path to full image file.
 * @param {string} previewPath Path to save the thumbnail.
 * @param {Gio.Cancellable} [cancellable=null]
 * @returns {Promise<boolean>}
 */
export async function ensureThumbnailAsync(sourcePath, previewPath, cancellable = null) {
    if (!sourcePath) return false;

    const previewFile = Gio.File.new_for_path(previewPath);
    if (previewFile.query_exists(null)) {
        return true;
    }

    const sourceFile = Gio.File.new_for_path(sourcePath);
    if (!sourceFile.query_exists(null)) {
        return false;
    }

    try {
        // 1. Read source file stream asynchronously
        const inStream = await sourceFile.read_async(GLib.PRIORITY_DEFAULT, cancellable);

        // 2. Decode and scale pixbuf asynchronously
        const pixbuf = await new Promise((resolve, reject) => {
            GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(
                inStream,
                PREVIEW_MAX_PX,
                PREVIEW_MAX_PX,
                true, // preserve aspect ratio
                cancellable,
                (stream, res) => {
                    try {
                        const pb = GdkPixbuf.Pixbuf.new_from_stream_finish(res);
                        resolve(pb);
                    } catch (e) {
                        reject(e);
                    } finally {
                        inStream.close_async(GLib.PRIORITY_DEFAULT, null);
                    }
                }
            );
        });

        if (!pixbuf) return false;

        // 3. Ensure parent directory exists
        const parentDir = previewFile.get_parent();
        if (parentDir && !parentDir.query_exists(null)) {
            parentDir.make_directory_with_parents(null);
        }

        // 4. Save to destination asynchronously
        const outStream = await previewFile.replace_async(null, false, Gio.FileCreateFlags.NONE, GLib.PRIORITY_DEFAULT, cancellable);
        await new Promise((resolve, reject) => {
            pixbuf.save_to_streamv_async(
                outStream,
                'png',
                [],
                [],
                cancellable,
                (pb, res) => {
                    try {
                        pb.save_to_stream_finish(res);
                        resolve(true);
                    } catch (e) {
                        reject(e);
                    } finally {
                        outStream.close_async(GLib.PRIORITY_DEFAULT, null);
                    }
                }
            );
        });

        return true;
    } catch (e) {
        console.warn(`Asynchronous thumbnail generation failed: ${e.message}`);
        return false;
    }
}
```

---

## 5. Garbage Collection & Cache Eviction

Cached GIFs and preview thumbnails must not grow unbounded. Maintain an eviction routine:

```javascript
import Gio from 'gi://Gio';

/**
 * Prune cache directory to keep only valid files.
 *
 * @param {string} cacheDir Directory path.
 * @param {Set<string>} validFilenames Set of active filenames in history.
 */
export async function pruneOrphanFiles(cacheDir, validFilenames) {
    const dir = Gio.File.new_for_path(cacheDir);
    const enumerator = await dir.enumerate_children_async(
        'standard::name',
        Gio.FileQueryInfoFlags.NONE,
        GLib.PRIORITY_LOW,
        null
    );

    let info;
    while ((info = enumerator.next_file(null)) !== null) {
        const name = info.get_name();
        if (!validFilenames.has(name)) {
            const child = dir.get_child(name);
            try {
                child.delete(null);
            } catch (e) {
                console.warn(`Failed to delete orphan file: ${name}`);
            }
        }
    }
}
```
