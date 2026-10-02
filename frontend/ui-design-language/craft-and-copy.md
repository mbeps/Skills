# Design Craft: Five Pillars, Copy, and Choreography

## Overview

Screen quality is judged across five pillars. A screen can be colour-perfect and still fail if the button label is wrong. Use the level model to spot which pillar is weak.

---

## The Five Pillars

| #   | Pillar           | Question it answers                                    |
| --- | ---------------- | ------------------------------------------------------ |
| 1   | UX copywriting   | Is the label clear, brief, and non-duplicative?        |
| 2   | Visuals & depth  | Does every visual effect carry information?            |
| 3   | Colour hierarchy | Is the accent rationed, and are shades generated well? |
| 4   | Typography       | Is the scale limited, and are numbers stable?          |
| 5   | Spacing          | Is everything on the grid and correctly grouped?       |

---

## The Four Design Levels

Use this to diagnose your own output, and to read other people's work.

| Level    | Years | Tell-tale failure                                   |
| -------- | ----- | --------------------------------------------------- |
| Beginner | 0–1   | Decoration over function. Elements compete.         |
| Junior   | 1–3   | Trend-chasing. Corrects one error, creates another. |
| Mid      | 3–6   | Over-engineered. Polished but not useful.           |
| Senior   | 7+    | Minimal and dynamic. Nothing decorative.            |

### Beginner

- Verbose labels. "Earn Tokens" for an action that just claims rewards.
- Gratuitous blur, harsh linear gradients, charts that obscure the data.
- Saturated primaries spread over large backgrounds (over 50%).
- Six or more font sizes, four or more weights on a single card.
- Arbitrary spacing: 11px here, 25px there.

**Fix:** apply the 60-30-10 rule, cap at 4 sizes and 2 weights per component, snap every value to the grid. Replace 11px with 12px. Replace 25px with 24px.

### Junior

Two opposite failures, both corrections going too far:

- **Skeuomorphic depth**: stacked drop shadows on flat components. Fix: keep charts neutral grey, use one bright accent dot for the active state.
- **Washed-out colour**: strips all brand saturation to escape the beginner's chaos. Result is lifeless. The fix is *tension*, not removal: neutral base, rationed accent.

Also reaches for technical jargon. "Commit Time" instead of "Votes committed".

**Fix:** write the copy out loud. If a label needs a tooltip to be understood, it is wrong.

### Mid

Has the skill to make an elaborate effect look acceptable, so makes one that does nothing. Also generates random multi-hue palettes.

**Fix:** derive all depth from a single core hue, generating tints and shades rather than inventing new hues. Group related components into explicit parent containers with consistent internal padding on the grid.

### Senior

- **Zero-redundancy copy**: strips words that duplicate the parent context. Header says "Voting", so sub-labels never say "votes". Card says "Rewards", so the button says "Claim", not "Claim Rewards".
- **Cross-component visual anchors**: the same pulsing dot appears on a status badge and on the active bar of a chart. One cue, one meaning, reused across components.
- **Layout stability for live data**: tabular figures for counters and prices; decimal points and trailing fractions rendered smaller by borrowing an existing step from the scale.
- **Flat colour restraint**: solid fills instead of gradients. Saturated hue only on interactive focal points.

---

## Pillar 1: UX Copywriting

### Zero-Redundancy Rule

**Do not repeat a word that the parent already established.** This is the highest-value copy rule and the most frequently broken.

| Parent title              | Verbose             | Correct         |
| ------------------------- | ------------------- | --------------- |
| Rewards                   | Claim Rewards       | Claim           |
| Voting                    | View Vote Details   | View            |
| Monthly Recurring Revenue | Generate MRR Report | Generate Report |
| Team Members              | Invite Team Member  | Invite          |

The rule cuts both ways:

- The button under "Rewards" must not say "Rewards".
- Conversely, a top-level action that appears **outside** the card needs the noun to stand alone. "Claim" alone in a global toolbar is a mystery.

### The Verb Test

**Every button label must name the precise outcome of the click.** Not the category, not the mechanism.

- ❌ "Earn Tokens" → the user does not earn. They claim what exists.
- ❌ "Manage" → too vague.
- ✅ "Claim" / "Claim 2,400 pts" / "Archive Project"

### The Jargon Test

Strip internal vocabulary. "Commit Time" is a database column. "Votes committed" is a fact.

### Procedure for Trimming Copy

1. Write the label long and complete.
2. Remove every word already visible in the parent context.
3. Keep the verb. Keep the noun only if it appears with no parent.
4. Read it aloud. If you would need to explain it, it is not finished.

---

## Pillar 2: Visuals & Depth

Every visual effect must answer: **what does this communicate?** If the answer is "nothing", remove it.

- **Depth tiers**: flat → raised → floating. Flat elements get borders, not shadows. Shadows mark genuine overlays only.
- **Data charts stay neutral**. Colour in a chart is reserved for the one series the user is meant to see.
- **Cross-component anchors**: define a cue once, reuse it. The status dot on a badge is the same dot, same colour, same animation, as the marker on the chart. This is how a dashboard teaches one visual language instead of many.
- **Self-aware charts**: if a chart's own visual noise hides its data, it has failed.

---

## Pillar 3: Colour Hierarchy

Two questions, both answered in [color-hsb.md](color-hsb.md):

- **Is the ratio right?** 60% neutral base, 30% structural, 10% accent, measured on surface area. If accent covers more than a tenth of the screen it has stopped signalling.
- **Are the shades generated correctly?** Dark shades come from removing white (saturation up, brightness down), never from brightness alone.

A palette that is well distributed but built with the wrong ramp is still a failure, and the reverse. Check both.

## Pillar 4: Typography

### Per-Component Caps

| Limit            | Value                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| Font sizes       | **4 maximum** per component or card                                                |
| Font weights     | **2 maximum** per component or card                                                |
| Weights to start | Regular (400), Medium (500), or Semi-Bold (600), at most two of the three per card |

The wider stylesheet budget (6 sizes) is separate. The tighter rule is per component. A card is one typographic object.

### Stable Numbers

Live-updating figures must not move the layout. Four rules, applied together:

1. **`tabular-nums`** — monospace digit widths, so `1` occupies the same space as `8`.
2. **Fixed format** — always the same number of decimals, so the character count is constant.
3. **Right alignment** — decimal points line up down the column.
4. **Reserved width** — set `min-width` in `ch` units so a rising balance never shoves the currency symbol or the button beside it.

```css
.balance {
  font-variant-numeric: tabular-nums;
  text-align: right;
  min-width: 12ch;
}
```

### Small Decimals

Render the decimal point and trailing fraction one step smaller, borrowing a size that **already exists** in the scale. Never invent a new size for the decimal. An integer-looking `4,281.93` reads as a single number, not two fragments.

---

## Pillar 5: Spacing

Snapping to the grid is mechanical: if a value is not a multiple of 4, round it to the nearest one. 11px becomes 12px. 25px becomes 24px. No judgement involved. Reach for 8s for layout containers and 4s for compact internals.

Grouping requires judgement: see the 4-point grid and Gestalt proximity rules in [dashboard-data.md](dashboard-data.md).

---

## Choreography: The Static Frame Trap

**A screen reviewed only as a static mockup is not reviewed.**

Static frames are what automated tools generate and what gets approved in review. The real product is a sequence of states. Ship a state matrix, not a picture.

### Required State Matrix

Controls must carry the **5 interaction states** (default, hover, active, focus, disabled). A screen as a whole must additionally define the **4 data states** (loading, success, error, empty) plus its screen-to-screen transition. Controls: 5. Screen: 9.

| State            | Must be specified                                           |
| ---------------- | ----------------------------------------------------------- |
| Hover            | Background change, cursor, transition timing                |
| Active/press     | Depression or scale, and how long it holds                  |
| Focus            | Ring colour, offset, and keyboard visibility                |
| Disabled         | Opacity, cursor, and whether the tooltip still explains why |
| Loading          | Skeleton shape, or spinner. Never a frozen control          |
| Success          | What confirms it, and how long it stays                     |
| Error            | Where the message appears, and what the user can do         |
| Empty            | What appears before the first record exists                 |
| Screen-to-screen | The transition path, not a hard cut                         |

### Rules

- **Timing**: 150ms for hover and press. 200ms for panels and overlays. Ease-out.
- **Loading must hold shape.** A skeleton matches the layout it replaces, so nothing reflows when data lands.
- **No animation on first load** beyond skeletons. Nothing bounces, flips, or spins into place.
- **Success needs a minimum dwell** (about 400ms) or the confirmation is too fast to read.
- **Respect `prefers-reduced-motion`.** Reduce to a cross-fade, not a removal.

### Benchmarks

Study products where motion carries meaning, not decoration: Airbnb (layout transitions), Duolingo (reward confirmation), Phantom (transaction state), Linear (speed and restraint).
