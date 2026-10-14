# Overview Search Providers (GNOME 45+)

Search Providers integrate with the GNOME Shell Activities Overview search bar. When a user presses the Super key and types a search query, registered search providers return results that appear alongside applications and system settings.

Common use cases include searching clipboard history, bookmarks, recent documents, emoji/symbols, web search shortcuts, or custom system commands.

---

## 1. Search Provider Architecture

A search provider in GNOME 45+ is an object registered with `Main.overview.searchController`:

```text
User types query in Overview Search
            │
            ▼
Main.overview.searchController
            │
    ┌───────┴────────────────────────┐
    ▼                                ▼
getInitialResultSet(terms)     getSubsearchResultSet(previous, terms)
    │                                │
    └───────────────┬────────────────┘
                    ▼
          Returns Result IDs: ['id1', 'id2', ...]
                    │
                    ▼
          filterResults(results, max)
                    │
                    ▼
          getResultMetas(resultIds)
                    │
                    ▼
          Renders Result Rows with createIcon(size, meta)
                    │
                    ▼
User clicks / hits Enter ──► activateResult(id, terms)
```

---

## 2. Complete Search Provider Implementation

```javascript
import St from 'gi://St';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

/**
 * Custom Overview Search Provider
 */
class CustomSearchProvider {
    constructor(extension) {
        this._extension = extension;
        this.id = 'my-custom-search-provider';
        this.isSearchProvider = true;
        this.canLaunchSearch = false; // Set true if you support launching a full dedicated app search

        // Dummy searchable database for demonstration
        this._items = [
            { id: 'item-1', name: 'Documentation', description: 'Open developer documentation', icon: 'help-browser-symbolic' },
            { id: 'item-2', name: 'Settings Manager', description: 'Configure custom extension options', icon: 'preferences-system-symbolic' },
            { id: 'item-3', name: 'Terminal Terminal', description: 'Launch terminal shortcut', icon: 'utilities-terminal-symbolic' },
        ];
    }

    /**
     * Called when a new search starts.
     *
     * @param {string[]} terms Array of search terms entered by the user
     * @param {Gio.Cancellable} cancellable Token to check if search was aborted
     * @returns {Promise<string[]>} List of matching unique result ID strings
     */
    async getInitialResultSet(terms, cancellable) {
        if (cancellable?.is_cancelled()) {
            throw new Error('Search cancelled');
        }

        const query = terms.join(' ').toLowerCase();
        const matches = this._items
            .filter(item => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query))
            .map(item => item.id);

        return matches;
    }

    /**
     * Called when search terms are refined (user types additional characters).
     *
     * @param {string[]} previousResults Result IDs returned by the previous search query
     * @param {string[]} terms New updated search terms
     * @param {Gio.Cancellable} cancellable
     * @returns {Promise<string[]>} Filtered result IDs
     */
    async getSubsearchResultSet(previousResults, terms, cancellable) {
        if (cancellable?.is_cancelled()) {
            throw new Error('Search cancelled');
        }

        return this.getInitialResultSet(terms, cancellable);
    }

    /**
     * Caps the number of displayed results in the overview.
     *
     * @param {string[]} results Full array of matched result IDs
     * @param {number} maxResults Maximum allowed results by GNOME Shell
     * @returns {string[]}
     */
    filterResults(results, maxResults) {
        return results.slice(0, maxResults);
    }

    /**
     * Provides display metadata for each visible search result ID.
     *
     * @param {string[]} resultIds IDs to retrieve metadata for
     * @param {Gio.Cancellable} cancellable
     * @returns {Promise<Array<{id: string, name: string, description: string, createIcon: (size: number) => St.Icon}>>}
     */
    async getResultMetas(resultIds, cancellable) {
        if (cancellable?.is_cancelled()) {
            throw new Error('Search cancelled');
        }

        const metas = [];
        for (const id of resultIds) {
            const item = this._items.find(i => i.id === id);
            if (!item) continue;

            metas.push({
                id: item.id,
                name: item.name,
                description: item.description,
                createIcon: (size) => {
                    return new St.Icon({
                        icon_name: item.icon,
                        icon_size: size,
                    });
                },
            });
        }

        return metas;
    }

    /**
     * Called when the user clicks or presses Enter on a search result.
     *
     * @param {string} id The activated item's unique identifier
     * @param {string[]} terms Search terms entered
     */
    activateResult(id, terms) {
        console.log(`Activated result ID: ${id} with query: ${terms.join(' ')}`);

        if (id === 'item-2') {
            this._extension.openPreferences();
        }
    }
}
```

---

## 3. Registering & Unregistering in Extension Lifecycle

Search providers must be registered with `Main.overview.searchController` in `enable()` and removed cleanly in `disable()`:

```javascript
export default class SearchExtension extends Extension {
    enable() {
        this._searchProvider = new CustomSearchProvider(this);

        // Register provider with GNOME Shell Overview
        Main.overview.searchController.addProvider(this._searchProvider);
        console.log('[SearchExtension] Overview search provider registered');
    }

    disable() {
        if (this._searchProvider) {
            // Remove provider from overview
            Main.overview.searchController.removeProvider(this._searchProvider);
            this._searchProvider = null;
            console.log('[SearchExtension] Overview search provider removed');
        }
    }
}
```

---

## 4. Best Practices & Performance

1. **Check `cancellable.is_cancelled()`:** Users type quickly. GNOME Shell triggers searches per keystroke. Always honor `cancellable` to avoid running stale queries in the background.
2. **Never Block the Event Loop:** If reading from disk, indexed caches, or DBus, use asynchronous operations (`load_contents_async`, `communicate_utf8_async`).
3. **Keep `createIcon` Lightweight:** Return an `St.Icon` with the requested `icon_size`. Do not perform file I/O inside `createIcon`.
4. **Result IDs Must Be Strings:** GNOME Shell expects string identifiers in `getInitialResultSet` and `getResultMetas`. Numbers or objects will cause type errors.
