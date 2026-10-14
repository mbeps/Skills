# Menu Hierarchy, Overlay Architecture, and Event Dispatching (GNOME 45+)

## Overview

GNOME Shell's Quick Settings drawer has a unique multi-root actor hierarchy designed to support background dimming, anchored submenus, and responsive grid layouts. Understanding this structure is essential when writing extensions that scroll the menu, reorder items, customize overlay animations, or intercept input events.

---

## The Complete Actor Tree

```text
Main.panel.statusArea.quickSettings (PanelMenu.Button)
 │
 ├── actor (Top Panel Actor)
 │     └── _indicators (St.BoxLayout)  <-- Holds top-bar status icons
 │
 └── menu (QuickSettingsMenu inherits PopupMenu.PopupMenu)
       └── actor (St.Widget, size 0x0)  <-- Root container hosting both branches
             ├── _boxPointer (BoxPointer)
             │     └── bin (St.Bin)
             │           └── box (St.BoxLayout, .quick-settings)
             │                 └── _grid (St.Widget with QuickSettingsLayout)  <-- Holds toggles & sliders
             │
             └── _overlay (St.Widget)  <-- Hosts open submenus outside _boxPointer
```

---

## Why Submenus Live in `_overlay` (Outside `_boxPointer`)

When a user clicks the chevron on a `QuickMenuToggle`, GNOME Shell performs a visual dimming effect on `_boxPointer` so that the main grid recedes into the background.

1. **Additive Texture Dimming**: GNOME Shell dims the background using an additive texture shader pass. If submenus were children of `box` or `_grid`, the dimming shader would crush the submenu's text and background from white down to grey.
2. **Sibling Overlay**: Because `_overlay` is a sibling of `_boxPointer` under the top-level `menu.actor`, it remains unaffected by the dimming effect applied to `_boxPointer`.
3. **Clutter Constraints**: Submenus in `_overlay` track their parent toggles using `Clutter.BindConstraint` (binding X, Y, and width coordinates to the toggle in the grid).

---

## Event Dispatching & The Scroll Trap

Extensions that attempt to handle mouse wheel scrolling or pointer gestures over the Quick Settings drawer frequently encounter silent event drops.

### Trap 1: `St.Button` Swallows Scroll Events

`QuickToggle` instances are subclasses of `St.Button`. In Clutter/St:
- `St.Button` attaches a `ClutterClickGesture` as an actor action.
- Actor actions execute in Clutter's **Capture Phase** (descending from the stage down to the actor), ahead of standard signal dispatching.
- The event is consumed before ancestor actors (like `_grid`, `box`, or `_boxPointer`) ever receive it.
- **Solution**: Connect to the `captured-event` signal on `_boxPointer` to intercept events on the way down before buttons consume them.

```javascript
menu._boxPointer.connectObject(
    'captured-event',
    (_actor, event) => this._onCapturedEvent(event),
    this
);
```

### Trap 2: Submenu Grabs Divert Event Routing

When an item in `_overlay` opens, it establishes a Clutter modal grab:
- When a grab is active, Clutter routes all pointer events starting directly at the grabbed submenu actor, completely bypassing `_boxPointer`.
- If an extension only listens to `_boxPointer`, scrolling stops working as soon as any submenu is opened.
- **Solution**: Watch `_overlay` for new child actors and attach `captured-event` to both roots.

```javascript
_watchSubmenus(overlay) {
    for (const actor of overlay) {
        actor.connectObject('captured-event', (_a, ev) => this._onCapturedEvent(ev), this);
    }

    overlay.connectObject(
        'child-added', (_o, actor) => {
            actor.connectObject('captured-event', (_a, ev) => this._onCapturedEvent(ev), this);
        },
        'child-removed', (_o, actor) => {
            actor.disconnectObject(this);
        },
        this
    );
}
```

### Trap 3: Discrete vs Emulated Smooth Scroll Events

A single physical notch of a modern mouse wheel or touchpad generates two events in Mutter:
1. A discrete scroll event (`Clutter.ScrollDirection.UP` or `DOWN`).
2. An emulated smooth scroll event synthesized alongside it.

If an extension acts on both, scrolling happens at double speed. Filter out emulated events immediately:

```javascript
_onScroll(event) {
    if (event.is_pointer_emulated()) {
        return Clutter.EVENT_STOP;
    }

    switch (event.get_scroll_direction()) {
    case Clutter.ScrollDirection.SMOOTH: {
        const [, dy] = event.get_scroll_delta();
        // Handle smooth delta
        break;
    }
    case Clutter.ScrollDirection.UP:
        // Handle discrete up
        break;
    case Clutter.ScrollDirection.DOWN:
        // Handle discrete down
        break;
    }
}
```

### Trap 4: Respecting Sliders and Nested ScrollViews

When intercepting scrolling over the menu, never scroll the outer container if the cursor is positioned over a `Slider` or an active `St.ScrollView` inside a submenu:

```javascript
_shouldPropagateScroll(event, rootScrollView) {
    const [x, y] = event.get_coords();
    const target = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);

    for (let actor = target; actor && actor !== rootScrollView; actor = actor.get_parent()) {
        // Sliders always claim scroll events to adjust values
        if (actor instanceof Slider) {
            return true;
        }

        // Submenu scroll views claim events if they have remaining scroll range
        if (actor instanceof St.ScrollView &&
            actor.vadjustment.upper > actor.vadjustment.page_size) {
            return true;
        }
    }
    return false;
}
```

---

## GNOME Version Differences (GNOME 45–51+)

| Feature | GNOME 45 | GNOME 46–50 | GNOME 51+ |
|---|---|---|---|
| Container add/remove signals | `actor-added` / `actor-removed` | `child-added` / `child-removed` | `child-added` / `child-removed` |
| Indicator scroll listener | `scroll-event` on actor | `scroll-event` on actor | `Clutter.ScrollController` action |
| Box pointer close options | `menu.close(PopupAnimation.FADE)` | `menu.close({ fadeOnly: true })` | `menu.close({ fadeOnly: true })` |
| Monitor scaling math | Physical pixels converted via `themeContext.scale_factor` | Same | Same |

### GNOME 51+ ScrollController Pattern

In GNOME 51+, listening directly to `scroll-event` on top-bar indicator icons is deprecated in favor of `Clutter.ScrollController`:

```javascript
import Clutter from 'gi://Clutter';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

const ShellVersion = parseFloat(Config.PACKAGE_VERSION);

if (ShellVersion >= 51) {
    const controller = new Clutter.ScrollController({
        flags: Clutter.ScrollControllerFlags.DISCRETE |
               Clutter.ScrollControllerFlags.SCROLL_VERTICAL |
               Clutter.ScrollControllerFlags.PHYSICAL_DIRECTION,
    });
    controller.connectObject('scroll', (_c, delta, event) => {
        this._handleScroll(delta);
    }, this);
    this._indicator.add_action(controller);
} else {
    this._indicator.connectObject('scroll-event', (_actor, event) => {
        this._handleScrollEvent(event);
    }, this);
}
```
