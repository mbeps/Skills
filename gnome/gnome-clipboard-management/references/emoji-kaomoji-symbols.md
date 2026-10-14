# Emojis, Kaomojis, and Unicode Symbols in GNOME Shell

## Overview

Clipboard managers often feature picker tabs for **Emojis**, **Kaomojis** (Japanese emoticons), and **Special Symbols**. Implementing these requires deep understanding of Unicode sequencing, Pango markup rendering, and Fitzpatrick skin tone modifiers.

---

## 1. Unicode Emoji Architecture

### A. Key Control Characters
* **Zero Width Joiner (ZWJ, `\u200D`):** Combines separate emoji code points into a single composite glyph.
  * Example: `👩` (`\u{1F469}`) + `ZWJ` (`\u200D`) + `💻` (`\u{1F4BB}`) = `👩‍💻` (Woman Technologist).
  * Example: `👨` + `ZWJ` + `❤️` + `ZWJ` + `👨` = `👨‍❤️‍👨` (Couple with Heart).
* **Variation Selector-16 (VS16, `\uFE0F`):** Forces emoji presentation instead of monochrome text glyphs.
  * Example: `\u2764` (Monochrome text heart `❤`) + `\uFE0F` = `❤️` (Colored emoji heart).
* **Fitzpatrick Skin Tone Modifiers (U+1F3FB through U+1F3FF):**
  * `🏻` (`\u{1F3FB}`) — Light
  * `🏼` (`\u{1F3FC}`) — Medium-Light
  * `🏽` (`\u{1F3FD}`) — Medium
  * `🏾` (`\u{1F3FE}`) — Medium-Dark
  * `🏿` (`\u{1F3FF}`) — Dark

---

## 2. Dynamic Skin Tone Application Algorithm

Applying skin tones dynamically requires:
1. Converting legacy precomposed characters to ZWJ equivalents if dual tones are requested.
2. Splitting the string along ZWJ (`\u200D`).
3. Stripping existing skin tone modifiers and any trailing `VS16`.
4. Appending user-selected tone modifiers to person components.
5. Restoring `VS16` if originally present and joining with `ZWJ`.

```javascript
const ZWJ = '\u200D';
const VS16 = '\uFE0F';
const SKIN_TONES = ['🏻', '🏼', '🏽', '🏾', '🏿'];

// Map legacy precomposed emojis to ZWJ equivalents for dual-tone support
const PRECOMPOSED_TO_ZWJ_MAP = {
    '\u{1F46B}': '👩‍🤝‍👨', // Woman and Man Holding Hands
    '\u{1F46C}': '👨‍🤝‍👨', // Men Holding Hands
    '\u{1F46D}': '👩‍🤝‍👩', // Women Holding Hands
    '\u{1F48F}': '🧑‍❤️‍💋‍🧑', // Kiss
    '\u{1F491}': '🧑‍❤️‍🧑', // Couple
};

// Text-default emojis that require VS16 (\uFE0F) for colorful emoji presentation when tone is absent
const TEXT_DEFAULT_EMOJI_BASES = new Set(['☝', '⛹', '✊', '✋', '✌', '✍']);

export class EmojiModifier {
    /**
     * Restore neutral emoji presentation, ensuring VS16 is restored for text-default base glyphs.
     */
    static restoreNeutral(base, hadVs16 = false) {
        if (hadVs16 || TEXT_DEFAULT_EMOJI_BASES.has(base)) {
            return base.endsWith(VS16) ? base : base + VS16;
        }
        return base;
    }

    /**
     * Strip skin tone modifiers and return pure base and whether VS16 was present in neutral form.
     */
    static stripTone(component) {
        let text = component;
        const hadVs16 = text.endsWith(VS16);
        if (hadVs16) {
            text = text.slice(0, -1);
        }

        for (const tone of SKIN_TONES) {
            if (text.endsWith(tone)) {
                text = text.slice(0, -tone.length);
                break;
            }
        }

        // Return base without tone. If had VS16 originally or is a text-default emoji, note VS16
        return { base: text, hadVs16: hadVs16 || TEXT_DEFAULT_EMOJI_BASES.has(text) };
    }

    /**
     * Apply primary and optional secondary skin tones to an emoji in compliance with Unicode UTS #51.
     *
     * @param {string} emojiChar Base emoji character.
     * @param {string|null} primaryTone One of SKIN_TONES or null.
     * @param {string|null} [secondaryTone=null] One of SKIN_TONES or null.
     * @param {Set<string>} [supportedBases] Optional Set of single characters that support tones.
     * @returns {string} Modified emoji character according to UTS #51.
     */
    static applyTone(emojiChar, primaryTone, secondaryTone = null, supportedBases = null) {
        if (!emojiChar) return '';
        if (!primaryTone) return this.stripAllTones(emojiChar);

        let current = emojiChar;
        // Convert legacy precomposed pairs to modern ZWJ sequence for dual-tone support
        if (secondaryTone && primaryTone !== secondaryTone && PRECOMPOSED_TO_ZWJ_MAP[current]) {
            current = PRECOMPOSED_TO_ZWJ_MAP[current];
        }

        const components = current.split(ZWJ);

        // Single component emoji (e.g. 👍, ✌️, 👩)
        if (components.length === 1) {
            const { base } = this.stripTone(components[0]);
            const isToneable = supportedBases ? supportedBases.has(base) : this._isToneableBase(base);

            if (isToneable) {
                // Unicode UTS #51: emoji_modifier_sequence := emoji_modifier_base emoji_modifier
                // Variation selectors (VS16) MUST NOT follow an emoji modifier
                return base + primaryTone;
            }
            return current;
        }

        // Multi-component ZWJ sequence (e.g. 🧑‍🤝‍🧑, 👩‍💻, 👨‍👩‍👧)
        let personIndex = 0;
        const modified = components.map((comp) => {
            const { base, hadVs16 } = this.stripTone(comp);

            // Handshake in holding-hands sequences must NOT receive skin tone
            if (base === '\u{1F91D}') {
                return comp;
            }

            // Check if this component can accept a skin tone
            const isToneable = supportedBases ? supportedBases.has(base) : this._isToneableBase(base);
            if (isToneable) {
                const tone = (personIndex === 0 ? primaryTone : (secondaryTone || primaryTone));
                personIndex++;
                // In UTS #51, skin tone replaces VS16 on modifier bases
                return base + tone;
            }

            // Non-toneable component preserves original neutral presentation
            return this.restoreNeutral(base, hadVs16);
        });

        return modified.join(ZWJ);
    }

    /**
     * Restore all components to neutral yellow/unmodified appearance with correct VS16 restoration.
     */
    static stripAllTones(emojiChar) {
        return emojiChar
            .split(ZWJ)
            .map((c) => {
                const { base, hadVs16 } = this.stripTone(c);
                return this.restoreNeutral(base, hadVs16);
            })
            .join(ZWJ);
    }

    /**
     * Evaluates whether a codepoint belongs to Unicode Emoji Modifier Bases.
     * Includes hand gestures, people, hair/role variations, and physical activities.
     */
    static _isToneableBase(char) {
        if (!char) return false;
        const code = char.codePointAt(0);

        return (
            (code >= 0x1F442 && code <= 0x1F450) || // Hand gestures: 👂, 👃, 👆, 👇, 👈, 👉, 👊, 👋, 👌, 👍, 👎, 👏, 👐
            (code >= 0x1F466 && code <= 0x1F478) || // People: 👶, 👧, 🧒, 👦, 👩, 🧑, 👨, 👵, 🧓, 👴, 👮, etc.
            (code >= 0x1F47C && code <= 0x1F487) || // Angel, dancers, masseuse, hairdresser
            (code >= 0x1F4AA && code <= 0x1F4AA) || // Biceps 💪
            (code >= 0x1F574 && code <= 0x1F575) || // Levitation, detective
            (code >= 0x1F590 && code <= 0x1F596) || // Raised hand, vulcan salute
            (code >= 0x1F645 && code <= 0x1F64F) || // Gesturing NO, OK, bow, raising hand, praying 🙏
            (code >= 0x1F6A3 && code <= 0x1F6B6) || // Rowboat, bicycle, pedestrian 🚶, runner 🏃
            (code >= 0x1F6C0 && code <= 0x1F6CC) || // Bath, bed
            (code >= 0x1F90C && code <= 0x1F93E) || // Pinched fingers, anatomical heart, sports
            (code >= 0x1F977 && code <= 0x1F977) || // Ninja
            (code >= 0x1F9B5 && code <= 0x1F9B9) || // Leg, foot, superhero
            (code >= 0x1F9CD && code <= 0x1F9CF) || // Standing, kneeling, deaf person
            (code >= 0x1F9D1 && code <= 0x1F9DE) || // Adult, beard, mage, fairy, vampire, merperson, elf, genie, zombie
            code === 0x261D ||                      // Pointing index ☝
            code === 0x26F9 ||                      // Ball athlete ⛹
            code === 0x270A ||                      // Fist ✊
            code === 0x270B ||                      // Raised hand ✋
            code === 0x270C ||                      // Victory ✌
            code === 0x270D                         // Writing hand ✍
        );
    }
}
```

---

## 3. Kaomojis and The Pango Markup Trap

Kaomojis are expressive ASCII/Unicode emoticons, such as:
* `(╯°□°)╯︵ ┻━┻`
* `<(^_^)>`
* `(づ｡◕‿‿◕｡)づ`
* `ಠ_ಠ`

### ⚠️ The Fatal Clutter / St.Label Trap
GNOME Shell's `St.Label` and `Clutter.Text` support Pango markup. If an actor has `label.clutter_text.use_markup = true`, characters like `<` and `>` in `<(^_^)>` are interpreted as XML tags. This causes a Pango parse error, resulting in **blank text or broken widget layout**.

### Rule: Always Escape or Disable Markup
When rendering Kaomojis or user text in widgets:
```javascript
import St from 'gi://St';
import GLib from 'gi://GLib';

// Approach 1: Disable markup entirely (Recommended for Kaomoji buttons)
const label = new St.Label({
    text: kaomojiString,
    style_class: 'kaomoji-item-label',
});
label.clutter_text.use_markup = false;

// Approach 2: If markup is needed elsewhere in the widget, escape the Kaomoji
const safeText = GLib.markup_escape_text(kaomojiString, -1);
label.clutter_text.set_markup(`<span size="large">${safeText}</span>`);
```

---

## 4. High-Performance Grid & Search Indexing

Rendering hundreds of emoji/kaomoji buttons simultaneously in Clutter causes significant frame drops during menu opening.

### Performance Optimizations:
1. **In-Memory Search Tokens:** Pre-tokenize search terms upon loading:
   ```javascript
   export function createSearchIndex(items) {
       return items.map((item) => ({
           data: item,
           tokens: `${item.name} ${item.category} ${item.keywords?.join(' ') || ''}`.toLowerCase(),
       }));
   }
   ```
2. **Lazy or Paginated Grids:** Limit initial actor creation to the first visible rows (e.g. 50 items). Append additional items on scroll or user pagination.
3. **Recently Used LRU Cache:** Maintain a small list (e.g. 30 items) of recently selected emojis and kaomojis stored in GSettings or a JSON file.
