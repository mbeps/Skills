# Suggestions & Snap Assist (GNOME 45+)

Snap Assist (Window Suggestions) enhances multi-tasking by prompting the user to fill vacant screen slots immediately after tiling a window. If a user snaps a browser to the left half of the display, the extension identifies the empty right half and presents the remaining open windows on that workspace.

---

## 1. Snap Assist Architectural Approaches

Two distinct UI patterns exist in production extensions:

| Architecture | Example Extension | Description | Best Suited For |
|---|---|---|---|
| **Modal Switcher Popup** | `tiling-assistant` | Centers a keyboard-navigable `SwitcherPopup` inside the vacant slot with background shading. | Keyboard-first workflows, rapid chaining across slots |
| **In-Slot Desktop Masonry** | `tilingshell` | Renders native `Shell.WindowPreview` cards directly within vacant tile previews on the desktop. | Mouse/touch-first workflows, visual discovery |

---

## 2. Approach A: Modal Switcher Popup (`SwitcherPopup`)

### Layout Allocation via `vfunc_allocate`

In GNOME Shell, `SwitcherPopup` spans the full stage/screen. Attempting to position the entire popup using `set_position()` breaks Clutter layout constraints. The correct implementation overrides `vfunc_allocate` to position `_switcherList` inside the target rectangle:

```javascript
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as SwitcherPopup from 'resource:///org/gnome/shell/ui/switcherPopup.js';

export const SnapAssistSwitcher = GObject.registerClass({
    Signals: {
        'window-selected': { param_types: [Meta.Window.$gtype] },
        'cancelled': {},
    },
},
class SnapAssistSwitcher extends SwitcherPopup.SwitcherPopup {
    _init(candidateWindows, targetRect, monitorIndex) {
        super._init(candidateWindows);

        this._targetRect = targetRect;
        this._monitorIndex = monitorIndex;
        this._shadeBG = null;
        this._grab = null;

        this._switcherList = new SnapAssistSwitcherList(this._items);
    }

    show(tiledWindows = []) {
        if (!this._items.length) return false;

        // 1. Acquire seat modal grab
        const grab = Main.pushModal(this);
        // Seat state verification (GNOME 45-49)
        if (typeof grab.get_seat_state === 'function') {
            if ((grab.get_seat_state() & Clutter.GrabState.KEYBOARD) === 0) {
                Main.popModal(grab);
                return false;
            }
        }
        this._grab = grab;

        this._switcherList.connect('item-activated', this._itemActivated.bind(this));
        this._switcherList.connect('item-entered', this._itemEntered.bind(this));
        this.add_child(this._switcherList);

        // 2. Dim background desktop windows while keeping tiled windows illuminated
        this._shadeBackground(tiledWindows);

        this.visible = true;
        this._select(0);
        this.opacity = 0;
        this.ease({
            opacity: 255,
            duration: 150,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        return true;
    }

    _shadeBackground(tiledWindows) {
        const ws = global.workspace_manager.get_active_workspace();
        const workArea = ws.get_work_area_for_monitor(this._monitorIndex);

        this._shadeBG = new St.Widget({
            style: 'background-color: rgba(0, 0, 0, 0.65);',
            x: workArea.x,
            y: workArea.y,
            width: workArea.width,
            height: workArea.height,
            opacity: 0,
        });

        global.windowGroup.add_child(this._shadeBG);
        this._shadeBG.ease({
            opacity: 255,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        // Ensure newly tiled windows stay elevated above the shade actor
        for (const win of tiledWindows) {
            const actor = win.get_compositor_private();
            if (actor) {
                global.windowGroup.set_child_above_sibling(actor, this._shadeBG);
            }
        }
    }

    vfunc_allocate(box) {
        this.set_allocation(box);

        if (!this._switcherList) return;

        const [, childNatWidth] = this._switcherList.get_preferred_width(-1);
        const [, childNatHeight] = this._switcherList.get_preferred_height(childNatWidth);

        // Center child switcher list precisely inside the vacant targetRect
        const childBox = new Clutter.ActorBox();
        const cx = this._targetRect.x + Math.floor((this._targetRect.width - childNatWidth) / 2);
        const cy = this._targetRect.y + Math.floor((this._targetRect.height - childNatHeight) / 2);

        childBox.x1 = Math.max(this._targetRect.x, cx);
        childBox.x2 = Math.min(this._targetRect.x + this._targetRect.width, childBox.x1 + childNatWidth);
        childBox.y1 = Math.max(this._targetRect.y, cy);
        childBox.y2 = Math.min(this._targetRect.y + this._targetRect.height, childBox.y1 + childNatHeight);

        this._switcherList.allocate(childBox);
    }

    _itemActivated(switcherList, index) {
        const selected = this._items[index];
        this.close();
        if (selected) {
            this.emit('window-selected', selected);
        }
    }

    _keyPressHandler(keysym, action) {
        if (keysym === Clutter.KEY_Escape) {
            this.cancel();
            return Clutter.EVENT_STOP;
        }
        if (keysym === Clutter.KEY_Return || keysym === Clutter.KEY_KP_Enter || keysym === Clutter.KEY_space) {
            this._itemActivated(this._switcherList, this._selectedIndex);
            return Clutter.EVENT_STOP;
        }
        if (keysym === Clutter.KEY_Left || keysym === Clutter.KEY_Up) {
            this._select(this._previous());
            return Clutter.EVENT_STOP;
        }
        if (keysym === Clutter.KEY_Right || keysym === Clutter.KEY_Down) {
            this._select(this._next());
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    cancel() {
        this.close();
        this.emit('cancelled');
    }

    close() {
        if (this._shadeBG) {
            this._shadeBG.destroy();
            this._shadeBG = null;
        }
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        this.destroy();
    }
});

class SnapAssistSwitcherList extends SwitcherPopup.SwitcherList {
    constructor(windows) {
        super(true);

        for (const win of windows) {
            const box = new St.BoxLayout({
                style_class: 'alt-tab-app',
                vertical: true,
                x_align: Clutter.ActorAlign.CENTER,
            });

            const winActor = win.get_compositor_private();
            if (winActor) {
                const clone = new Clutter.Clone({
                    source: winActor,
                    width: 160,
                    height: 100,
                });
                box.add_child(clone);
            }

            const label = new St.Label({
                text: win.get_title() || 'Window',
                x_align: Clutter.ActorAlign.CENTER,
            });
            box.add_child(label);

            this.addItem(box, label);
        }
    }
}
```

---

## 3. Approach B: In-Slot Desktop Masonry (`Shell.WindowPreview`)

Instead of opening a modal grab, `tilingshell` renders suggested window preview cards directly inside each vacant tile slot on the stage:

```javascript
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

export const SuggestedPreviewCard = GObject.registerClass({
    Signals: { 'selected': {} },
},
class SuggestedPreviewCard extends Shell.WindowPreview {
    _init(metaWindow) {
        super._init({
            reactive: true,
            can_focus: true,
            windowContainer: new Clutter.Actor(),
        });

        this._metaWindow = metaWindow;
        this.windowContainer.layout_manager = new Shell.WindowPreviewLayout();
        this.add_child(this.windowContainer);
        this._addWindow(metaWindow);

        // App Icon & Title Header
        const tracker = Shell.WindowTracker.get_default();
        const app = tracker.get_window_app(metaWindow);
        if (app) {
            const icon = app.create_icon_texture(32);
            this.add_child(icon);
        }

        this.connect('button-release-event', () => {
            this.emit('selected');
            return Clutter.EVENT_STOP;
        });
    }
});
```

---

## 4. Filtering Candidate Windows (MRU Order)

```javascript
import Meta from 'gi://Meta';

/**
 * Returns eligible candidate windows for Snap Assist in MRU (Most Recently Used) order.
 *
 * @param {Meta.Workspace} workspace
 * @param {number} monitorIndex
 * @param {Meta.Window[]} excludedWindows
 * @returns {Meta.Window[]}
 */
export function getSnapAssistCandidates(workspace, monitorIndex, excludedWindows = []) {
    const excludedIds = new Set(excludedWindows.map(w => w.get_id()));

    // Query Mutter MRU window list for active workspace
    const mruList = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);

    return mruList.filter(win => {
        if (!win || excludedIds.has(win.get_id())) return false;

        // Restrict to same monitor
        if (win.get_monitor() !== monitorIndex) return false;

        // Skip utility, desktop, or unmanageable windows
        if (win.is_skip_taskbar() || win.is_override_redirect()) return false;
        if (win.get_window_type() !== Meta.WindowType.NORMAL) return false;
        if (!win.allows_move() || !win.allows_resize()) return false;

        return true;
    });
}
```

---

## 5. Consecutive Multi-Slot Chaining Loop

```javascript
export async function runSnapAssistLoop(tilingManager, initialWindow, vacantSlots, monitorIndex) {
    let currentTiled = [initialWindow];

    for (const slotRect of vacantSlots) {
        const ws = global.workspace_manager.get_active_workspace();
        const candidates = getSnapAssistCandidates(ws, monitorIndex, currentTiled);

        if (candidates.length === 0) break;

        const chosenWindow = await promptWindowForSlot(candidates, slotRect, monitorIndex, currentTiled);
        if (!chosenWindow) break; // User cancelled; exit chain

        await tilingManager.tile(chosenWindow, slotRect, { openTilingPopup: false });
        currentTiled.push(chosenWindow);
    }
}

function promptWindowForSlot(candidates, slotRect, monitorIndex, tiledWindows) {
    return new Promise(resolve => {
        const switcher = new SnapAssistSwitcher(candidates, slotRect, monitorIndex);
        switcher.connect('window-selected', (_, win) => resolve(win));
        switcher.connect('cancelled', () => resolve(null));
        if (!switcher.show(tiledWindows)) {
            resolve(null);
        }
    });
}
```

---

## 6. Edge Cases & Trap Avoidance

1. **Unmanaged Candidate Defense:** If a candidate application crashes or closes while the switcher is displayed, attempting to tile it throws `Error: Trying to operate on an unmanaging window!`. Always track candidate lifecycle:
   ```javascript
   candidateWin.connectObject('unmanaging', () => this._onCandidateClosed(candidateWin), this);
   ```
2. **Restoring Focus on Cancellation:** If the user dismisses the suggestion popup (via Escape or click away), immediately restore focus to the initial tiled window so keyboard focus does not get stranded on the desktop background:
   ```javascript
   initialWindow.activate(global.get_current_time());
   ```
