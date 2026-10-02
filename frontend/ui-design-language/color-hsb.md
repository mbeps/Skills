# Colour: HSB Mechanics & The 60-30-10 Rule

## Overview

The eye reads colour through **HSB (Hue, Saturation, Brightness)**, even though screens emit RGB. Reason in HSB, export to hex. Never guess hex codes by eye.

---

## 1. The Three Channels

| Channel    | Range   | Meaning                                                              |
| ---------- | ------- | -------------------------------------------------------------------- |
| **Hue**    | 0°–360° | Position on the colour wheel. The colour family.                     |
| **Sat**    | 0%–100% | Colour injected into grey. `0%` = flat grey, `100%` = purest form.   |
| **Bright** | 0%–100% | Light intensity. `0%` = black. `100%` = white **only if Sat is 0%**. |

Reference angles: Red `0°` (and `360°`), Green `120°`, Blue `240°`.

### Black Is Not the Opposite of White

The two ends are **asymmetrical**. This trips up most people:

- **White** needs **two** conditions: `B:100%` **and** `S:0%`.
- **Black** needs **one**: `B:0%`. The entire bottom edge of the picker is black, at any saturation.

So there is no single "add white" operation. There are two, and they look different:

```
                    ADDING WHITE  (tints)          Saturation down, Brightness up
              S:0  B:100  |  (White)            |  S:100 B:100  (Vivid hue)
                             |                     |
              S:0  B:0    |  (Black)  ---- HSB --- |  S:100 B:0    (Black)
                             |                     |
                    ADDING BLACK vs REMOVING WHITE
        Adding black:        Brightness down             (dull, muddy)
        Removing white:      Saturation up, Brightness down (rich, deep)
```

---

## 2. Generating Shades: The "Remove White" Method

**This is the single most important rule in the file.**

### The Mistake: Adding Black

Lowering **brightness alone** drains the colour. You get a dull, muddy, grey-brown shade.

### The Method: Removing White

When building dark hover states, dark mode panels, or dark borders, **raise saturation while lowering brightness**:

$$
\text{Rich dark shade} = \text{Saturation } \uparrow \;+\; \text{Brightness } \downarrow
$$

Lowering the light level also destroys the perception of colour. Raising saturation restores the pigment the darkening took away.

### Proof (blue, H=240)

Both swatches below sit at the **same** luminance (0.0052). Only saturation differs:

| HSB      | Hex       | Chroma | Reads as         |
| -------- | --------- | ------ | ---------------- |
| S80 B20  | `#0A0A33` | 41     | Dead, muddy navy |
| S100 B30 | `#00004C` | 76     | Rich, deep blue  |

Same lightness. Nearly double the colour. Use the second one for hover states and dark surfaces.

### Working Blue Ramp (H=240)

Teaching example. **For a real brand, build the ramp at your own brand hue** (see the brand ramp below).

| Role             | HSB         | Hex           |
| ---------------- | ----------- | ------------- |
| Vivid accent     | S80 B80     | `#2929CC`     |
| Tint (chip fill) | S40 B95     | `#9191F2`     |
| Light tint       | S20 B100    | `#CCCCFF`     |
| Shade (bad)      | S80 B20     | `#0A0A33`     |
| **Shade (rich)** | **S95 B32** | **`#040452`** |

Red ramp, same rule: `S80 B20` = `#330A0A` (mud) vs `S100 B35` = `#590000` (rich).

### Brand Ramp (H=221, Royal Blue `#2563EB`)

**This is the ramp to copy.** It keeps hue fixed at the brand angle and applies the remove-white method down the ramp. All values verified.

| Role              | HSB     | Hex       |
| ----------------- | ------- | --------- |
| Accent (rest)     | S84 B92 | `#2563EB` |
| Accent hover      | S90 B74 | `#1349BD` |
| Accent active     | S94 B58 | `#093594` |
| Light tint (chip) | S30 B98 | `#AFC7FA` |
| Deep shade (text) | S90 B50 | `#0D3180` |

Note the progression: brightness falls 92 → 74 → 58 → 50 while saturation **rises** 84 → 90 → 94 → 90. That is the whole method in one table.

`#2563EB` and `#2664EB` are the same HSB value (H221 S84 B92, differing only in rounding). Prefer the existing design-system token so the ramp matches the rest of the product.

### Hovering an Already-Bright Accent

The proof table shows near-black shades. Hovering a bright button like `#2563EB` uses the same operation: lower brightness and raise saturation to compensate. `B92 → B74` with `S84 → S90`.

Do **not** lighten the button on hover in a dark interface; lightening a saturated fill in a dark context reads as a glow. Step brightness by enough to be visible (roughly 10 to 20 points), not by 2 to 4.

---

## 3. Tone By Hue Shift, Not By Raw Primary

Do not use textbook primaries. Nudge the angle to change mood:

| Target             | Shift to | Use when                                   |
| ------------------ | -------- | ------------------------------------------ |
| Sky / friendly     | `210°`   | Light, approachable, consumer products     |
| Indigo / technical | `260°`   | Modern, cool, high-tech, developer tools   |
| Soft error red     | `350°`   | Approachable alerts that must not alarm    |
| Urgent red-orange  | `15°`    | Harsh warnings needing immediate attention |

---

## 4. Reducing Visual Dominance

**When one element overwhelms the rest, do not move its hue. Lower its saturation.**

High saturation pulls the eye forward. Low saturation pushes the element into the background. This is how you mute a chip, a disabled row, or a secondary metric without changing what colour it means.

Shifting hue to "soften" a colour is a **misuse**: it changes the signal, not the emphasis.

---

## 5. The 60-30-10 Rule

Enforce the ratio on **surface area**, not on token count. Measure per screen.

| Share   | Layer                | What it is                                        |
| ------- | -------------------- | ------------------------------------------------- |
| **60%** | Neutral base         | Canvas, page background, the dominant surface     |
| **30%** | Structural secondary | Cards, dividers, borders, secondary text          |
| **10%** | Accent brand colour  | Primary CTA and active status indicators **only** |

**Accent is rationed.** If more than roughly a tenth of the screen is saturated, the accent has stopped signalling and has become decoration. Screens that are mostly tables (leaderboards, logs, listings) must stay almost entirely neutral so the accent still reads as an accent.

### Dark Mode Neutral Tiers

**The canonical ramp** (slate, H≈222). Every other file in this skill refers to these four values. Derive your own at your brand hue using the same method.

| Tier         | Hex       | Relative luminance |
| ------------ | --------- | ------------------ |
| Canvas       | `#020617` | 0.0021             |
| Card / panel | `#0F172A` | 0.0088             |
| Popover      | `#1E293B` | 0.0218             |
| Modal        | `#334155` | 0.0514             |

Keep the same hue and saturation family across every tier. Tinting each surface with a different hue is what makes dark modes look dirty.

**8-bit tolerance.** At these very low saturations a single 8-bit step visibly shifts the measured hue, so a generated ramp will never be perfectly constant. Hold hue within about 15 degrees and check by eye. If exactness matters, use `oklch()`.

Keep the canvas genuinely deep. Do not settle on `#1f1f1f` or similar flat mid-greys; those read as muddy rather than deep, and they are the exact failure the dark-mode guidance warns against.

---

## 6. HSB vs HSL

|                      | HSB                      | HSL                                                                              |
| -------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| Model                | Real-world light physics | White and black as opposites (`L:0%` black, `L:100%` white, pure hue at `L:50%`) |
| Matches design tools | Figma, Sketch            | CSS only                                                                         |
| Result               | Predictable ramps        | Raising `L` above 50% washes hue out along unpredictable curves                  |

**Use HSB.** It matches the pickers in Figma and Sketch, so what you reason about is what you get.

### Honest Limitation

HSB brightness is **not perceptually uniform**. Equal steps in `B` do not look like equal steps in lightness. Step `B` in small increments (2 to 4) and check the result. For a ramp you intend to ship as CSS custom properties, `oklch()` gives uniform lightness steps and is a reasonable production choice. Use HSB to decide the **relationships**, then encode the final values.

### Contrast Is Not Negotiable

HSB tells you how colour behaves. It does not tell you whether text is readable.

**Every text token must clear WCAG AA against the surface it sits on: 4.5:1 for body text, 3:1 for large text (18px bold or 24px and above), and 3:1 for UI component boundaries and focus indicators.**

Saturated brand colour is for **fills**, not body text. `#2563EB` on a dark card measures 3.45:1 and fails as text. To set brand-coloured text on dark, step brightness up: `#3B82F6` reaches 4.87:1, `#60A5FA` reaches 7.05:1.

All figures above are measured against the canonical slate ramp.

Muted text is where this goes wrong. `#64748B` on `#020617` gives only 4.24:1, and on a popover surface it collapses to 3.07:1.

Check secondary text against the **lightest tier it can appear on**, not the canvas:

- On canvas, card, and popover tiers, `#94A3B8` is safe (7.87:1, 6.96:1, 5.71:1).
- On a **modal** (`#334155`) it drops to 4.04:1 and fails. Use `#A8B6C9` there (5.03:1).

The same trap applies to opacity. A disabled control at 50% opacity composites to roughly `#525D71` on a dark card, which is 2.69:1 and fails even the 3:1 UI floor. **Never halve the opacity of text that carries meaning.** If a disabled control must still be readable, use a colour that already passes at full opacity and dim only decoration.
---

## 7. Applying the Method

1. Pick **one** base hue. Derive every neutral tier, tint, and shade from it.
2. Set the 60-30-10 split before writing any component.
3. Generate dark shades with `S↑ + B↓`. Never `B↓` alone.
4. Mute a competing element with `S↓`. Never with a hue shift.
5. Reserve saturated colour for the primary CTA and active status. Nothing else.
