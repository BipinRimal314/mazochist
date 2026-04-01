# Design System Specification: The Saccharine Subversion

## 1. Overview & Creative North Star
**Creative North Star: "The Deceptive Storybook"**

This design system is built on a foundation of "Aggressive Optimism." It rejects the cold, sterile tropes of traditional gaming interfaces in favor of a lush, tactile, and disarmingly "squishy" aesthetic. By mimicking the visual language of high-end children’s editorial design—thick paper stocks, rounded edges, and a warm, sun-drenched palette—we create a psychological juxtaposition. The UI should feel like a hug, even when the gameplay is a slap. 

We break the "template" look by avoiding rigid, boxy layouts. Instead, we utilize **intentional asymmetry**, overlapping surface layers, and a massive typography scale to create a "floating" organic feel. Elements should never feel "anchored" to a cold grid; they should feel like they were tossed onto a soft nursery rug.

---

## 2. Colors & Surface Soul
The palette is a high-energy pastel explosion. We move beyond flat hex codes by using tonal depth to define the interface's "physicality."

### The "No-Line" Rule
**Borders are forbidden.** Traditional 1px solid lines are too clinical for this world. Sections are defined exclusively through background shifts. For example, a `surface-container-low` activity log should sit directly on a `surface` background. The change in tone provides the boundary, keeping the interface soft and approachable.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, pillowy layers. Use the `surface-container` tiers to create depth:
*   **Base Layer:** `surface` (#fef6e4) for the main canvas.
*   **Secondary Content:** `surface-container-low` (#f8f0dd) for sidebars or grouping.
*   **Elevated Components:** `surface-container-lowest` (#ffffff) for high-priority interactive cards to make them "pop" against the cream background.

### The Glass & Gradient Rule
To prevent the UI from looking "flat" or "corporate-vector," use **Glassmorphism** for floating overlays (e.g., pause menus or level-up notifications). Use a `surface-bright` color at 80% opacity with a `20px` backdrop-blur. 
*   **Signature Textures:** Apply a subtle linear gradient to main CTAs, transitioning from `primary` (#993862) at the bottom to `primary-container` (#fa86b2) at the top. This gives buttons a "lit from above" gummy-candy appearance.

---

## 3. Typography: The Bouncy Editorial
We use a high-contrast typographic scale to guide the player's eye with personality.

*   **Display & Headlines (Plus Jakarta Sans):** These are our "shouty" elements. They should be tracked slightly tighter (-2%) to feel chunky and cohesive. Use `display-lg` for game-over screens and `headline-md` for section titles.
*   **Body & Titles (Be Vietnam Pro):** While the headers are playful, the body text remains legible. The warm plum tones of the text (`on-surface`) ensure that even long blocks of "suffering" descriptions are easy on the eyes.
*   **Identity through Scale:** A massive `display-lg` header next to a tiny, lowercase `label-sm` creates a boutique, editorial feel that feels intentional rather than accidental.

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to show "height"; we use shadows to show "weight."

*   **The Layering Principle:** Depth is achieved by stacking. Place a `surface-container-lowest` card on top of a `surface-dim` area. The contrast creates a natural lift without the "dirtiness" of a gray drop shadow.
*   **Ambient Shadows:** For floating elements (like the Mascot or Primary Buttons), use a highly diffused shadow. 
    *   *Shadow Property:* `0px 12px 32px rgba(45, 51, 74, 0.08)`. The shadow is tinted with our Deep Plum (`on-surface`) to keep it warm and integrated into the cream environment.
*   **The "Ghost Border" Fallback:** If a component requires a boundary for accessibility, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons (The "Gummy" Variants)
*   **Primary:** Pill-shaped (`rounded-full`), using the `primary` to `primary-container` gradient. 
*   **Secondary:** `secondary-container` (#a3ecf6) with `on-secondary-container` text.
*   **Interaction:** On hover, use a "Squash and Stretch" animation—scale to 1.05 and slightly flatten (0.95 Y-axis) to mimic a physical soft object being pressed.

### Cards & Lists
*   **No Dividers:** Lists are separated by `spacing-4` (1.4rem) of vertical white space or by alternating background tints between `surface-container-low` and `surface-container-high`.
*   **Shape:** Use `rounded-xl` (3rem) for large containers to maintain the "bubbly" feel.

### Input Fields
*   **Style:** Background-filled with `surface-container-highest`. No border.
*   **Active State:** Transitions to a `secondary` ghost-border (20% opacity) with a soft `secondary-fixed-dim` outer glow.

### The Mascot Overlay
*   The round fuzzy blob should never be static. It should hover near active UI components, overlapping container edges to break the layout's "contained" feel.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** embrace asymmetry. If you have two cards, try making one slightly larger or offset by a few pixels.
*   **Do** use lowercase for `label` styles to enhance the "soft" brand voice.
*   **Do** use the full spacing scale. Generous white space is the difference between "cluttered" and "premium."

### Don’t:
*   **Don’t** use pure black (#000). Use the Deep Plum (`on-surface`) for all dark values to maintain warmth.
*   **Don’t** use sharp corners (0-12px). If it can poke an eye out, it doesn't belong in this system.
*   **Don’t** use standard ease-in-out transitions. Use `cubic-bezier(0.34, 1.56, 0.64, 1)` for a "bouncy" spring effect that aligns with the children's book aesthetic.

---

## 7. Signature Spacing Scale
Our spacing is intentionally "loose."
*   **Standard Padding:** `spacing-6` (2rem) is the default for internal card padding.
*   **Gutter/Margin:** `spacing-10` (3.5rem) between major layout sections to provide "breathing room" for the player's inevitable frustration.