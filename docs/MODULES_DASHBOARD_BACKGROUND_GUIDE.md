# VendAI Modules Dashboard Background — Technical Guide

This document explains how to recreate the **glassmorphic, multi-layered background effect** used on the VendAI modules dashboard. It combines **dark gradients**, **radial glows**, and **backdrop blur** to create a modern, premium feel.

---

## 1. Base Color Palette

The entire dashboard uses a **dark slate-based color scheme** to anchor the UI:

| Color            | Hex / OKLCH                        | Usage                          |
|------------------|-------------------------------------|--------------------------------|
| **Background**   | `oklch(0.18 0.04 245)`             | Base body background           |
| **Card Base**    | `oklch(0.24 0.05 245)`             | Module card background         |
| **Border**       | `oklch(0.32 0.04 245)` with 10–15% alpha | Subtle card outlines      |
| **Muted Text**   | `oklch(0.76 0.05 235)`             | Secondary text                 |

---

## 2. Body Background (Full Viewport)

The **body element** in `app/globals.css` sets up the base gradient with multiple **radial glows** and a **linear gradient overlay**:

```css
body {
  @apply text-foreground antialiased;
  min-height: 100vh;
  background-color: var(--background); /* oklch(0.18 0.04 245) */
  background-image:
    radial-gradient(closest-side at 18% 20%, rgba(56, 189, 248, 0.18), transparent 65%),
    radial-gradient(farthest-corner at 85% 10%, rgba(59, 130, 246, 0.16), transparent 60%),
    radial-gradient(closest-side at 50% 100%, rgba(129, 140, 248, 0.14), transparent 70%),
    linear-gradient(135deg, rgba(6, 12, 23, 0.94), rgba(3, 18, 34, 0.98));
  background-attachment: fixed;
  color: var(--foreground);
}
```

**Breakdown:**
- **Radial 1** (`18% 20%`): Cyan glow in upper left (sky blue).
- **Radial 2** (`85% 10%`): Blue accent in upper right.
- **Radial 3** (`50% 100%`): Indigo glow at bottom center.
- **Linear gradient**: Diagonal overlay from dark slate to almost-black, unifying the radials.

`background-attachment: fixed` ensures the gradient stays put when scrolling.

---

## 3. Module Container Background (Dashboard Page)

The main dashboard container uses the `.module-background` class (defined in `globals.css`) which applies a **pseudo-element** for layered control:

```css
.module-background {
  position: relative;
  isolation: isolate;
  z-index: 0;
  background: transparent;
}

.module-background::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    radial-gradient(closest-side at 18% 20%, rgba(56, 189, 248, 0.18), transparent 65%),
    radial-gradient(farthest-corner at 85% 10%, rgba(59, 130, 246, 0.16), transparent 60%),
    radial-gradient(closest-side at 50% 100%, rgba(129, 140, 248, 0.14), transparent 70%),
    linear-gradient(135deg, rgba(6, 12, 23, 0.94), rgba(3, 18, 34, 0.98));
  background-size: cover;
  background-repeat: no-repeat;
}
```

In `components/modules-dashboard.tsx`, the root `motion.div` applies this class:

```tsx
<motion.div 
  className="module-background flex flex-col h-[calc(100vh-2.5rem)] p-6 overflow-hidden"
  initial={{ opacity: 0, y: -300 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.08, ease: [0.4, 0.0, 0.2, 1] }}
>
```

---

## 4. Module Cards — Glassmorphic Layers

Each module card has **three background layers**:

### 4.1 Card Base Gradient

The `.cardBase` class from the `palette` object applies a **multi-stop gradient** with a **color tint**:

```tsx
palette: {
  cardBase: 'bg-gradient-to-br from-slate-950/88 via-slate-950/72 to-emerald-950/32',
  // ...other keys
}
```

For example, the **POS module** uses:
- **From:** `slate-950/88` (88% opacity dark slate)
- **Via:** `slate-950/72` (72% opacity)
- **To:** `emerald-950/32` (32% opacity emerald tint at bottom-right)

This creates a **subtle color wash** without overwhelming the card.

### 4.2 Hover Glow Overlay

On hover, a **semi-transparent gradient** fades in using Tailwind's `group-hover:` modifier:

```tsx
<div className={`absolute inset-0 bg-gradient-to-br ${module.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
```

Where `bgGradient` is defined per module:

```tsx
bgGradient: 'from-emerald-500/[0.14] via-emerald-500/[0.07] to-emerald-500/[0.04]'
```

This adds a **colored glow layer** that intensifies on hover (14% → 7% → 4% opacity), giving the card a "lit-up" effect.

### 4.3 Border + Backdrop Blur

The card itself uses:

```tsx
className="rounded-3xl backdrop-blur-2xl border border-emerald-400/15 hover:border-emerald-300/25"
```

- **`backdrop-blur-2xl`**: Blurs any content behind the card (from Tailwind's `backdrop-filter` utilities).
- **Border**: Starts at 15% opacity emerald, brightens to 25% on hover.

### 4.4 Icon Container

The icon sits in a **nested glassmorphic container**:

```tsx
<div className={`w-20 h-20 rounded-2xl backdrop-blur-2xl ${palette.iconBg} border border-white/5 flex items-center justify-center group-hover:scale-110 transition-all duration-500`}>
  <Icon className={`w-10 h-10 ${module.color} ${module.hoverColor}`} 
        style={{
          filter: `drop-shadow(0 4px 8px rgba(34, 197, 94, 0.28)) 
                   drop-shadow(0 2px 4px rgba(34, 197, 94, 0.14)) 
                   drop-shadow(0 0 12px rgba(34, 197, 94, 0.18)) 
                   drop-shadow(0 0 24px rgba(34, 197, 94, 0.1))`
        }} />
</div>
```

Where `iconBg` is:

```tsx
iconBg: 'bg-gradient-to-br from-emerald-500/[0.16] via-emerald-500/[0.08] to-emerald-400/[0.12]'
```

**Drop shadows** on the icon give it a **soft glow** matching the module's theme color (emerald, blue, purple, etc.).

---

## 5. Top Highlight Line

A **subtle top border glow** appears on hover:

```tsx
<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
```

This creates a **horizontal glint** along the top edge when you hover, reinforcing the glassmorphic aesthetic.

---

## 6. Header & Profile Dropdowns

The **header buttons** (Settings, Profile) use a similar layered approach:

```tsx
<button className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105">
  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
  <Settings className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
</button>
```

The **profile dropdown** itself follows the same pattern:

```tsx
<div className="relative rounded-2xl backdrop-blur-xl bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.04] border border-white/[0.12] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.4)]">
  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-pink-500/[0.02] rounded-2xl"></div>
  <div className="relative p-6">
    {/* dropdown content */}
  </div>
</div>
```

**Key takeaway:** All interactive elements (cards, buttons, dropdowns) share the **same layering strategy**:
1. Outer container with `backdrop-blur` + white gradient base
2. Overlay `div` with colored gradient at low opacity
3. Hover transitions that brighten borders and scale the element

---

## 7. Color-Specific Palettes Per Module

Each module defines its own `palette` object to unify colors across card, icon, and text:

| Module       | Primary Color | Card Tint            | Icon Glow          |
|--------------|---------------|----------------------|--------------------|
| **POS**      | Emerald       | `emerald-950/32`     | Green drop-shadow  |
| **Inventory**| Blue          | `blue-950/32`        | Blue drop-shadow   |
| **Suppliers**| Purple        | `purple-950/32`      | Purple drop-shadow |
| **Logistics**| Orange        | `amber-950/32`       | Orange drop-shadow |
| **Retailers**| Cyan          | `cyan-950/32`        | Cyan drop-shadow   |

Example for **POS**:

```tsx
palette: {
  cardBase: 'bg-gradient-to-br from-slate-950/88 via-slate-950/72 to-emerald-950/32',
  iconBg: 'bg-gradient-to-br from-emerald-500/[0.16] via-emerald-500/[0.08] to-emerald-400/[0.12]',
  ring: 'ring-emerald-400/25',
  title: 'text-emerald-200/85',
  muted: 'text-emerald-200/60'
}
```

---

## 8. Shadow Strategy

Shadows are applied in **three contexts**:

1. **Resting state** (cards, buttons):
   ```tsx
   shadow-[0_18px_48px_-28px_rgba(15,23,42,0.5)]
   ```
   (Soft, deep shadow for depth)

2. **Hover state** (cards):
   ```tsx
   hover:shadow-[0_24px_56px_-28px_rgba(16,185,129,0.2)]
   ```
   (Colored shadow matching module theme—emerald for POS)

3. **Icon drop-shadow**:
   ```tsx
   filter: drop-shadow(0 4px 8px rgba(34, 197, 94, 0.28)) 
           drop-shadow(0 0 12px rgba(34, 197, 94, 0.18))
   ```
   (Multiple layers for a soft glow effect)

---

## 9. Putting It All Together

**Recreating the modules dashboard background:**

1. **Body**: Add the multi-radial + linear gradient to `body` in your global CSS.
2. **Container**: Wrap your dashboard in a `div` with `.module-background` to apply the pseudo-element layer.
3. **Cards**: Use a gradient base (`from-slate-950/88 via-slate-950/72 to-[color]-950/32`) + `backdrop-blur-2xl` + colored border.
4. **Hover Overlay**: Add an `absolute inset-0` div with a low-opacity gradient that fades in on `group-hover`.
5. **Icon**: Nest inside a smaller glassmorphic container with its own gradient + drop-shadow filters.
6. **Shadows**: Apply resting and hover shadows with `rgba` colors at 20–50% opacity.

**Result:** A **layered, glassmorphic, multi-depth background** with subtle color accents that respond to hover and maintain a cohesive dark theme across the entire dashboard.

---

## 10. Quick Reference

### Color Variables (OKLCH)
```css
--background: oklch(0.18 0.04 245);
--card: oklch(0.24 0.05 245);
--border: oklch(0.32 0.04 245);
--muted-foreground: oklch(0.76 0.05 235);
```

### Gradient Stack (Body)
```css
background-image:
  radial-gradient(closest-side at 18% 20%, rgba(56, 189, 248, 0.18), transparent 65%),
  radial-gradient(farthest-corner at 85% 10%, rgba(59, 130, 246, 0.16), transparent 60%),
  radial-gradient(closest-side at 50% 100%, rgba(129, 140, 248, 0.14), transparent 70%),
  linear-gradient(135deg, rgba(6, 12, 23, 0.94), rgba(3, 18, 34, 0.98));
```

### Card Classes (Tailwind)
```tsx
className="rounded-3xl backdrop-blur-2xl bg-gradient-to-br from-slate-950/88 via-slate-950/72 to-emerald-950/32 border border-emerald-400/15 hover:border-emerald-300/25"
```

### Icon Glow (Inline Style)
```tsx
style={{
  filter: `drop-shadow(0 4px 8px rgba(34, 197, 94, 0.28)) 
           drop-shadow(0 2px 4px rgba(34, 197, 94, 0.14)) 
           drop-shadow(0 0 12px rgba(34, 197, 94, 0.18)) 
           drop-shadow(0 0 24px rgba(34, 197, 94, 0.1))`
}}
```

---

**That's the full breakdown!** Copy this pattern into any component to achieve the same **dark, glowing, glassmorphic** look used across the VendAI modules dashboard. Adjust the colors (emerald → blue, purple, etc.) to match your branding.
