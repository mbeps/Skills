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

### Trap 5: Click-Safe Drag/Swipe Over `St.Button` Toggles (GNOME 49+)

`St.Button` attaches a `Clutter.ClickGesture` (`CLUTTER_PHASE_BUBBLE`), which runs ahead of actor event signals:
- Returning `Clutter.EVENT_STOP` from `BUTTON_PRESS` or `TOUCH_BEGIN` inside `captured-event` cancels `Clutter.ClickGesture`, silently breaking clicks.
- **Solution**: Always return `Clutter.EVENT_PROPAGATE` on `BUTTON_PRESS` / `TOUCH_BEGIN`. Only return `Clutter.EVENT_STOP` on `MOTION` / `TOUCH_UPDATE` and `BUTTON_RELEASE` / `TOUCH_END` once movement exceeds the drag threshold (`6px`), and temporarily disable the pressed toggle's actions (`for (const a of toggle.get_actions()) a.enabled = false;`, restoring on `GLib.idle_add` after release) rather than calling `clear_actions()`.

---

## Customizing `_overlay` & Submenu Transitions

When replacing default accordion expansion with custom overlay or full-panel page transitions, preserve `_overlay`'s parenting inside `QuickSettingsMenu.actor` (to keep `PopupMenuManager` modal grabs and avoid `_boxPointer` dimming) and handle these constraints:

1. **Discover `_overlay` constraints by `coordinate`, not array index**: Constraint count and ordering vary across Shell versions (`POSITION` + `WIDTH` vs `X` + `Y` + `WIDTH`). Inspect `overlay.get_constraints()` for `Clutter.BindConstraint` instances and check `constraint.coordinate` (`X`, `Y`, `POSITION`, `WIDTH`).
2. **Do not animate `_grid.translation_x` while upstream `_overlay` position constraints are active**: Upstream `QuickSettingsMenu` updates `_overlay`'s `X`/`Y` `BindConstraint.offset` on `Meta.LaterType.BEFORE_REDRAW` via `this._grid.apply_relative_transform_to_point(this._boxPointer, new Graphene.Point3D())`, which includes `_grid.translation_x`. Disable upstream position constraints and drive replacement `X`/`Y` constraints (bound to `_boxPointer`, which shares `_overlay`'s parent) from `menu.box.apply_relative_transform_to_point(_boxPointer, ...)` plus `menu.box.get_theme_node()` padding/border on `BEFORE_REDRAW`.
3. **Never show `_grid` and a replacement sizer simultaneously in `menu.box`**: `menu.box` is a vertical `St.BoxLayout` and sums the heights of all visible children. Keep `_grid` and any rest-state sizer mutually exclusive in visibility, ease `menu.box.height` directly during transitions with `clip_to_allocation = true`, and add a temporary `HEIGHT` `BindConstraint` on `_overlay` (bound to `menu.box` minus vertical padding/border) so tall submenus clip cleanly during slides.
4. **Wrap `menu._header` rather than mutating its `GridLayout`**: To inject a back button beside `menu._header`, reparent `menu._header` into a horizontal `St.BoxLayout` (with no `_delegate` so `PopupMenuBase._getMenuItems()` skips it) at index `0` of `menu.box`, restoring `menu._header` to `menu.box` on teardown. This keeps `setHeader()`, `addHeaderSuffix()`, and RTL mirroring intact.

---

## Customizing `QuickSettingsLayout` Without Reparenting

Avoid reparenting toggles out of `_grid` (which breaks submenu constraints, `QuickSettingsLayout` row height, and other extensions). Instead:
1. **Subclass, don't instance-patch**: GJS binds `vfunc_*` C trampolines at `GObject.registerClass` time, so patching `layout.vfunc_allocate` on an instance is ignored. Lazily create and cache one `GObject.registerClass` subclass of `origLayout.constructor` (avoiding duplicate `GTypeName` on reload), swap `grid.layout_manager`, and copy each child's `column-span` via `get_child_meta` / `child_set_property` (restoring `origLayout` and `column-span`s on `disable()`).
2. **Respect `_overlay`**: `layout._overlay` is a visible placeholder child inside `_grid`. Always skip `child === layout._overlay` in `_getRows()`, call `layout._overlay.allocate_available_size(0, 0, box.get_width(), overlayHeight)` in `vfunc_allocate()`, and add `overlayHeight` after any row where `row.some(c => c.menu?.actor.visible)`.
3. **Hide off-page toggles without mutating `.visible`**: Built-in toggles bind `.visible` to hardware/service state. Hide inactive-page toggles with `opacity = 0`, `reactive = false`, and `0x0` allocation instead of `.hide()`.

### Trap 5: `Clutter.EVENT_STOP` Cancels `St.Button` `Clutter.ClickGesture` (GNOME 49+)

In GNOME 49+, `St.Button` handles clicks via an attached `Clutter.ClickGesture` (`CLUTTER_PHASE_BUBBLE`), which runs *before* actor event signals (`button-press-event`, `touch-event`). If any actor handler on the button or an ancestor returns `Clutter.EVENT_STOP` on `BUTTON_PRESS` or `TOUCH_BEGIN`, `clutter_sprite_propagate_event` immediately cancels every `Clutter.Gesture` in the emission chain—including the button's own `Clutter.ClickGesture`—causing clicks and taps to silently do nothing.

- **Avoid `EVENT_STOP` on child `St.Button`s:** Let press/touch events propagate, and in parent drag handlers skip starting a drag/grab when the picked target is inside a child `St.Button` or `Slider`.
- **Use `get_actor_at_pos`, not `event.get_source()`:** In Clutter 17+, `event.get_source()` returns `null` for press/touch events (only populated for `ENTER`/`LEAVE`). Query `global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, ...event.get_coords())`.
- **Disabling inherited `St.Button` gestures safely:** Set `action.enabled = false` on `actor.get_actions()` rather than calling `clear_actions()`, which can leave `StButton`'s internal C `priv->click_gesture` pointer unparented.

---

## GNOME Version Differences (GNOME 45–51+)

| Feature | GNOME 45 | GNOME 46–50 | GNOME 51+ |
|---|---|---|---|
| Container add/remove signals | `actor-added` / `actor-removed` | `child-added` / `child-removed` | `child-added` / `child-removed` |
| `St.BoxLayout` direction prop | `vertical: boolean` | `orientation: Clutter.Orientation` (48+) | `orientation: Clutter.Orientation` |
| Indicator scroll listener | `scroll-event` on actor | `scroll-event` on actor | `Clutter.ScrollController` action |
| Box pointer / submenu close options | `menu.close(PopupAnimation.FADE)` | `menu.close({ fadeOnly: true })` (BoxPointer); `PopupAnimation.NONE` (QuickToggleMenu) | `menu.close({ fadeOnly: true })` (BoxPointer); `{ animate: false }` (QuickToggleMenu) |
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
