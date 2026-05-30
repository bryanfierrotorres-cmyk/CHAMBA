---
name: Field Trust & Momentum
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-price:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 16px
  stack-gap: 12px
  touch-target-min: 48px
---

## Brand & Style
This design system is engineered for the high-stakes environment of service technicians, where clarity equals efficiency and trust is built through professional precision. The style is **Corporate Modern** with an energetic edge—combining the reliability of enterprise tools with the motivating "ready-to-work" feel of a consumer app. 

The aesthetic prioritizes high-contrast "at-a-glance" readability. It utilizes a clean, mobile-first architecture that emphasizes large touch targets, spacious card layouts, and a bright, optimistic color palette to reduce cognitive load during a busy workday. The UI should evoke a sense of momentum and accomplishment.

## Colors
The palette is centered on high-trust blue and high-momentum green.
- **Primary Blue (#2563EB):** Reserved for navigation, branding, and core functional actions. It signals stability and professional authority.
- **Success Green (#10B981):** A vibrant, crisp green used exclusively for positive outcomes: "Accept" actions, "Verified" statuses, and financial figures (prices/earnings).
- **Neutral Suite:** A scale of grays from deep charcoal for text (#1E293B) to a very light, cool gray (#F9FAFB) for page backgrounds, ensuring card surfaces pop.
- **Surface White:** Pure #FFFFFF is used for cards and inputs to provide maximum contrast against the light gray background.

## Typography
The system uses **Inter** for its exceptional legibility on small screens and its neutral, systematic feel. 
- **Numerical Emphasis:** For prices and earnings, use `display-price`. The bold weight and tight letter spacing create a sense of significant value and clarity.
- **Hierarchy:** Maintain a strict hierarchy. Headings should be semi-bold or bold to anchor the user's eye on card titles, while body text remains clean and unobstructed.
- **Micro-copy:** Use `label-bold` for status chips and badges to ensure they are readable even at very small sizes.

## Layout & Spacing
This system follows a **Fixed-Fluid Hybrid** model optimized for handheld devices.
- **The Grid:** A standard 4-column mobile grid with 16px side margins and 12px gutters.
- **Rhythm:** Spacing is built on an 8px base unit. Use 16px for internal card padding and 12px for vertical spacing between list items (stack-gap).
- **Mobile Ergonomics:** All interactive elements must maintain a minimum 48px height/width for easy thumb interaction.
- **Safe Areas:** Adhere to system-level safe areas for notches and home indicators, ensuring critical action buttons (like "Accept Job") are never obscured.

## Elevation & Depth
The system uses **Ambient Shadows** to create a clear physical metaphor for "tappable" surfaces.
- **Cards (Level 1):** Use a soft, diffused shadow with a wide blur (12px to 16px) and low opacity (8-10%) to lift cards off the #F9FAFB background. 
- **Sticky Actions (Level 2):** Floating buttons or bottom sheets use a slightly more aggressive shadow to indicate they sit above the primary scrollable content.
- **Tonal Layering:** Use the subtle contrast between pure white cards and light gray backgrounds rather than heavy borders to define sections.

## Shapes
The shape language is friendly and modern, utilizing significant corner radii to soften the "industrial" nature of service work.
- **Standard Cards:** Use `rounded-lg` (16px) for all job cards and dashboard modules.
- **Buttons:** Use `rounded-lg` (16px) or fully pill-shaped for a more approachable feel.
- **Inputs:** Consistent 8px or 12px rounding to match the card language without feeling overly bubbly.

## Components
- **Job Cards:** Large white containers featuring a `headline-md` title, `body-sm` address text, and a prominent `display-price` in Success Green.
- **Action Buttons:** Primary buttons are vibrant blue; "Accept" or "Success" buttons are bright green. Buttons should span the full width of the container for mobile accessibility.
- **Status Chips:** Small, high-contrast badges (e.g., "Verified", "Priority") using the `label-bold` type style and a subtle background tint of the status color.
- **Input Fields:** Large, 56px height fields with 1px light gray borders that thicken and turn Primary Blue when focused.
- **Iconography:** Use a "Dual-Tone" or "Soft-Color" style. For example, a "Cleaning" icon features a blue sofa with a light blue background circle, keeping the visual language diverse but unified.
- **Service Lists:** Use 1px horizontal dividers with 16px of vertical breathing room between list items.