# Top Bar & Overlay Layout Toolbars (GNOME 45+)

Modern tiling extensions provide visual layout discovery via top-screen overlays and top panel indicators. When a user drags a window towards the top of the monitor, an animated toolbar drops down, displaying selectable layout templates. Releasing the window over a template slot tiles it directly.

---

## 1. Architectural Patterns

There are two primary UI integration models:

| Component | Parent Container | Lifecycle / Visibility | User Interaction |
|---|---|---|---|
| **Snap Assistant Toolbar** | `Main.layoutManager.addTopChrome` | Appears dynamically when dragging a window near the top screen edge | Drop target: hovering slots highlights full-screen tile previews; releasing tiles window |
| **Panel Indicator Menu** | `Main.panel.addToStatusArea` | Persistent icon in GNOME top bar | Click to switch active layout, trigger layout editor, or view shortcuts |
| **Layout Switcher OSD** | `SwitcherPopup.SwitcherPopup` | Transient modal popup via keybinding | Keyboard cycling (arrows / shortcuts) to switch layouts on focused monitor |

---

## 2. Dynamic Drag Overlay Toolbar (Snap Assistant)

The toolbar supports three distinct visibility states:
1. `HIDDEN`: Completely invisible above the screen edge.
2. `PEEK`: Slightly revealed at the top of the screen when a drag begins, signaling to the user that moving up will activate layouts.
3. `SHOWN`: Fully slid down when the pointer reaches the upper activation threshold.

```text
 ┌─────────────────────────────────────────────────────────────────┐
 │                   [ Top Bar / Chrome Layer ]                    │
 │         ┌──────────────────────────────────────────────┐        │
 │         │  [ 50/50 ]   [ 25/50/25 ]   [ 4-Quarters ]   │  ◄ Slide down on drag
 │         └──────────────────────────────────────────────┘        │
 │                                                                 │
 │         ┌───────────────┐                                       │
 │         │ Dragged Window│                                       │
 │         └───────────────┘                                       │
 └─────────────────────────────────────────────────────────────────┘
```

### Implementation

```javascript
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const LayoutToolbarState = Object.freeze({
    HIDDEN: 0,
    PEEK: 1,
    SHOWN: 2,
});

export const SnapAssistantOverlay = GObject.registerClass({
    Signals: {
        'slot-hovered': { param_types: [GObject.TYPE_JSOBJECT] },
        'slot-selected': { param_types: [GObject.TYPE_JSOBJECT] },
    },
},
class SnapAssistantOverlay extends St.Bin {
    _init(monitorIndex) {
        super._init({
            style_class: 'snap-assistant-container',
            reactive: true,
            visible: false,
            opacity: 0,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
        });

        this._monitorIndex = monitorIndex;
        this._state = LayoutToolbarState.HIDDEN;
        this._hoveredSlot = null;

        // Container holding layout thumbnail cards
        this._cardsBox = new St.BoxLayout({
            style_class: 'snap-assistant-content popup-menu-content',
            x_expand: true,
        });
        this.set_child(this._cardsBox);

        // Register with GNOME Chrome manager so it stays above regular windows
        Main.layoutManager.addTopChrome(this);

        // Smooth actor clipping during slide down
        this.connectObject('notify::translation-y', () => {
            if (this.height > 0) {
                this.set_clip(0, Math.max(0, this.height - this.translation_y), this.width, this.height);
            }
        }, this);

        this._updatePosition();
    }

    _updatePosition() {
        const monitor = Main.layoutManager.monitors[this._monitorIndex];
        if (!monitor) return;

        this.set_position(
            monitor.x + Math.round((monitor.width - this.width) / 2),
            monitor.y
        );
    }

    onDragStarted() {
        this.setState(LayoutToolbarState.PEEK);
    }

    onDragFinished() {
        this.setState(LayoutToolbarState.HIDDEN);
    }

    /**
     * Called during window drag movement.
     * @param {number} cursorX
     * @param {number} cursorY
     * @param {number} monitorIndex
     */
    onCursorMove(cursorX, cursorY, monitorIndex) {
        if (monitorIndex !== this._monitorIndex) {
            this.setState(LayoutToolbarState.HIDDEN);
            return;
        }

        const monitor = Main.layoutManager.monitors[this._monitorIndex];
        const triggerDistance = 48; // Trigger when within 48px from monitor top

        if (cursorY <= monitor.y + triggerDistance) {
            this.setState(LayoutToolbarState.SHOWN);
        } else if (this._state === LayoutToolbarState.SHOWN && cursorY > monitor.y + 120) {
            this.setState(LayoutToolbarState.PEEK);
        }
    }

    setState(state) {
        if (this._state === state) return;
        this._state = state;

        this.remove_all_transitions();

        if (state === LayoutToolbarState.HIDDEN) {
            this.ease({
                opacity: 0,
                translation_y: -this.height,
                duration: 150,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => {
                    this.visible = false;
                    this.remove_clip();
                },
            });
        } else if (state === LayoutToolbarState.PEEK) {
            this.visible = true;
            this.ease({
                opacity: 180,
                translation_y: 12, // Peek 12px into view
                duration: 200,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        } else if (state === LayoutToolbarState.SHOWN) {
            this.visible = true;
            this.ease({
                opacity: 255,
                translation_y: this.height,
                duration: 220,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this.remove_clip();
                },
            });
        }
    }

    destroy() {
        Main.layoutManager.removeChrome(this);
        super.destroy();
    }
});
```

---

## 3. Mini Layout Card Component

Each layout button in the toolbar displays a miniature vector representation of the layout's tile slots:

```javascript
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

export const LayoutMiniCard = GObject.registerClass({
    Signals: {
        'slot-hovered': { param_types: [GObject.TYPE_JSOBJECT] },
        'slot-selected': { param_types: [GObject.TYPE_JSOBJECT] },
    },
},
class LayoutMiniCard extends St.Widget {
    _init(layout, cardWidth = 120, cardHeight = 68) {
        super._init({
            style_class: 'layout-mini-card',
            reactive: true,
            width: cardWidth,
            height: cardHeight,
        });

        this._layout = layout;
        this._buildSlots(cardWidth, cardHeight);
    }

    _buildSlots(w, h) {
        const gap = 3;
        for (const slot of this._layout.slots) {
            const slotActor = new St.Button({
                style_class: 'mini-slot-cell',
                x: Math.round(slot.x * w) + gap,
                y: Math.round(slot.y * h) + gap,
                width: Math.max(10, Math.round(slot.width * w) - (gap * 2)),
                height: Math.max(10, Math.round(slot.height * h) - (gap * 2)),
                reactive: true,
            });

            slotActor.connect('notify::hover', () => {
                if (slotActor.hover) {
                    slotActor.add_style_pseudo_class('active');
                    this.emit('slot-hovered', slot);
                } else {
                    slotActor.remove_style_pseudo_class('active');
                }
            });

            slotActor.connect('clicked', () => {
                this.emit('slot-selected', slot);
            });

            this.add_child(slotActor);
        }
    }
});
```

---

## 4. Top Panel Status Indicator (`PanelMenu.Button`)

The persistent indicator exposes layout selection and settings without legacy APIs:

```javascript
import St from 'gi://St';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export const TilingPanelIndicator = GObject.registerClass({
    Signals: {
        'open-preferences': {},
        'layout-selected': { param_types: [GObject.TYPE_STRING] },
    },
},
class TilingPanelIndicator extends PanelMenu.Button {
    _init(extensionPath) {
        super._init(0.5, 'Tiling Window Manager', false);

        const iconPath = `${extensionPath}/icons/tiling-symbolic.svg`;
        const icon = new St.Icon({
            gicon: Gio.icon_new_for_string(iconPath),
            style_class: 'system-status-icon',
        });
        this.add_child(icon);

        this._populateMenu();
    }

    _populateMenu() {
        this.menu.removeAll();

        // Section header
        const header = new PopupMenu.PopupMenuItem('Layouts', { reactive: false });
        this.menu.addMenuItem(header);

        // Layout items
        const layouts = ['Split Half', '3-Columns', 'Quarters'];
        for (const name of layouts) {
            const item = new PopupMenu.PopupMenuItem(name);
            item.connect('activate', () => {
                this.emit('layout-selected', name);
            });
            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Open Settings - GNOME 45+ clean signal to Extension.openPreferences()
        const settingsItem = new PopupMenu.PopupMenuItem('Tiling Preferences…');
        settingsItem.connect('activate', () => {
            this.emit('open-preferences');
        });
        this.menu.addMenuItem(settingsItem);
    }
});
```

In `extension.js`:
```javascript
export default class TilingExtension extends Extension {
    enable() {
        this._indicator = new TilingPanelIndicator(this.path);
        this._indicator.connect('open-preferences', () => this.openPreferences());
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
```

---

## 5. Overlay Lifecycle & Clean Dismount

Overlay chrome actors live outside the standard GTK widget hierarchy. Strict rules must be followed:

1. **Remove Chrome on Disable:** Call `Main.layoutManager.removeChrome(overlay)` in `disable()`. Forgetting this leaves an invisible floating actor that swallows top-bar click events.
2. **Workarea Sync:** Connect to `global.display.connectObject('workareas-changed', () => this._updatePosition(), this)` and `Main.layoutManager.connectObject('monitors-changed', () => this._updatePosition(), this)`.
3. **Shutdown Grace:** Listen to `global.connectObject('shutdown', ...)` to disconnect before Mutter tears down internal seat managers.
