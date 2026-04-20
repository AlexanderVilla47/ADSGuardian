# Design System Strategy: The Kinetic Curator

## 1. Overview & Creative North Star
The design system for this application is built upon the **"Kinetic Curator"** North Star. In the high-stakes world of influencer contract management and ad control, "standard" dashboarding leads to cognitive fatigue. Our objective is to move beyond the spreadsheet-inspired "grid of boxes" into a high-end, editorial experience that feels authoritative yet effortless.

We reject the rigid, boxed-in nature of legacy enterprise software. Instead, we use **Intentional Asymmetry**, **Tonal Layering**, and **Typographic Authority** to guide the user’s eye to what matters most. The interface doesn't just show data; it "curates" the workflow, highlighting risk and performance through sophisticated visual cues rather than loud alerts.

---

## 2. Colors: Tonal Architecture
We utilize a sophisticated palette anchored by **Primary Violet (#9A28C9)**. Rather than relying on lines to separate concepts, we use a "chromatic atmosphere" to define the workspace.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. 
Structure is achieved through:
- **Background Shifts:** Using `surface-container-low` against a `surface` background.
- **Negative Space:** Relying on the spacing scale to create mental groupings.
- **Tonal Transitions:** Subtle shifts in container saturation to denote hierarchy.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, semi-opaque sheets.
- **Base Layer:** `surface` (#fff7fb) – The canvas.
- **Primary Work Areas:** `surface-container-low` (#feeffd) – Large content blocks.
- **Actionable Cards:** `surface-container-lowest` (#ffffff) – Used to "lift" key data points (KPIs) off the page.
- **Interactive Overlays:** `surface-container-highest` (#ecdeec) – For tooltips and flyouts.

### The "Glass & Gradient" Rule
To ensure the app feels premium, use **Glassmorphism** for floating elements (e.g., Header navigation, floating action buttons).
- **Token Application:** Apply `surface_variant` with 60% opacity and a `20px` backdrop-blur. 
- **Signature Textures:** Main Action Buttons and Hero KPIs should utilize a subtle linear gradient: `primary` (#7c00a9) to `primary_container` (#9a28c9) at a 135° angle. This adds "soul" and depth that flat hex codes lack.

---

## 3. Typography: Editorial Authority
We pair **Manrope** (Display/Headlines) with **Inter** (Interface/Data) to create an editorial feel that remains highly functional for technical IDs.

- **The Power of Scale:** Use `display-md` for high-level KPIs. The large scale commands attention without needing "Warning" icons.
- **Technical IDs:** `execution_id` and `correlation_id` must always use `label-sm` or `body-sm`. These are secondary data points; they should be legible but recede into the background until needed, using `on_surface_variant`.
- **Hierarchical Contrast:** Pair a `headline-sm` title (Manrope, Bold) with a `body-md` description (Inter, Regular). This contrast in "voice" helps users scan contracts vs. operational statuses instantly.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "heavy" for a fast, clean dashboard. We define depth through light and tone.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. This creates a natural "pop" that feels architectural.
- **Ambient Shadows:** For Modals or Detail Panels, use an extra-diffused shadow: `0px 12px 32px rgba(54, 46, 56, 0.06)`. Note the use of the `inverse_surface` color for the shadow tint rather than pure black.
- **The "Ghost Border":** If a data table requires separation for accessibility, use the `outline_variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Operational Primitives

### Action Buttons
- **Primary:** Gradient fill (`primary` to `primary_container`), `xl` roundedness (0.75rem). No border. White text.
- **Secondary:** `surface_container_high` background with `on_secondary_container` text. These should feel like part of the interface, not a separate "box."

### Data Tables & Status
- **No Dividers:** Remove all horizontal/vertical lines. Use alternating row colors (`surface` and `surface-container-low`) or simply 16px of vertical padding to separate entries.
- **Risk Indicators:** Use semantic containers. A "CRITICAL" status is a `error_container` pill with `on_error_container` text. Keep them small; the color carries the weight.

### KPI Cards
- Large `display-sm` numbers.
- Background: `surface-container-lowest`.
- Roundedness: `xl` (0.75rem).
- Inclusion of a subtle 2px left-accent bar using the `primary` token to denote "active" tracking.

### Event Timelines
- Use a single `outline_variant` vertical track at 20% opacity.
- Events are marked by `primary` dots.
- Technical IDs (`execution_id`) should be rendered in `label-sm` using a mono-spaced variant of Inter if available, or simply a lower opacity to reduce visual noise.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `surface-container` tiers to group related contract terms.
- **Do** prioritize white space over lines. If the layout feels "messy," add 8px of padding rather than a border.
- **Do** use `primary_fixed` for hover states on interactive cards to create a soft "glow" effect.

### Don’t
- **Don't** use pure black (#000000) for text. Always use `on_surface` (#201922) to maintain the violet-tinted professional aesthetic.
- **Don't** use standard 4px "Material" shadows. They look dated. Stick to tonal layering.
- **Don't** cram technical IDs into primary table columns. Move `correlation_id` to a detail modal or a secondary "Ghost" text layer.

### Accessibility Note
While we lean into subtle tones, ensure all text-to-background contrast ratios meet WCAG AA standards. Use `on_surface` for all primary body copy to ensure the #201922 value provides enough "punch" against the #fff7fb background.