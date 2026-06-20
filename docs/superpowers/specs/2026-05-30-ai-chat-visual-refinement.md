# AI Chat Panel Visual Refinement

**Date:** 2026-05-30
**Status:** approved

## Goal

Refine the AI chat panel's visual layering: separate the gradient-blurred background from the controls card, improve the rainbow edge animation, and reposition the chat controls to the right side.

## Current State

- `.panel` spans full width (sidebar to window right edge), applies `backdrop-filter: blur(28px)` with a gradient mask (opaque right → transparent left) across the entire panel including content
- Controls (messages, input, header) are inside the gradient-blurred panel, centered
- `.rainbowEdge` is a single 4px vertical line on the right edge only

## Design

### 1. Rainbow Ripple Border Animation

Replace the single right-edge line with a full-window four-edge rainbow border that ripples from right to left when the panel opens.

**Structure:** One fixed container + 4 child elements (top, right, bottom, left edges).

**Animation (panel open):**
| Edge | Delay | Behavior |
|--------|-------|-----------------------------------------|
| Right | 0ms | Lights up first |
| Top | 150ms | Grows from right end toward left |
| Bottom | 150ms | Grows from right end toward left |
| Left | 350ms | Last to appear, completing the frame |

**Animation (panel close):** Reverse or fade out.

Each edge has:

- Flowing rainbow gradient (`linear-gradient` with animated color stops)
- `box-shadow` glow for bloom effect
- Subtle pulse/ripple via opacity or scale micro-variation

### 2. Background Layer (`.panel`)

- Full-width overlay (sidebar-left to window-right)
- `backdrop-filter: blur(28px) saturate(120%)` with gradient mask (strong blur right, clear left)
- **No content** — purely decorative background
- The existing `.panel` div becomes this background layer

### 3. Controls Card (new `.controlsCard`)

- Width: ~45% of available space (the area between sidebar and right edge)
- Position: right-aligned with ~4% right margin
- `backdrop-filter: blur(16px)` — uniform Gaussian blur (no gradient mask)
- `border-radius: 20px` — rounded card appearance
- Semi-transparent dark background (`rgba(0,0,0,0.2)`)
- Contains: header, messages area, input area

### Layout Diagram

```
┌─═ Rainbow ripple border (4 edges, right-to-left cascade) ═──┐
│ Sidebar │                           │  ┌──────────────┐     │
│         │   Background gradient blur │  │ Controls     │     │
│         │   (blur 28px + mask)      │  │ Card         │     │
│         │   clear ← → strong blur   │  │ blur(16px)   │     │
│         │                           │  │ 45% width    │     │
│         │                           │  └──────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

## Files to Change

- `src/components/ai/ChatPanel.tsx` — restructure markup: extract controls into `.controlsCard`
- `src/components/ai/ChatPanel.module.css` — new styles for background layer, controls card, rainbow edges

## Constraints

- ZZZ/Neo-Tokyo dark aesthetic maintained
- Existing color palette (`#48dbfb`, `#54a0ff`, `#ff9ff3`, `#feca57`, `#ff6b6b`, `#5f27cd`) reused for rainbow
- Keep the existing panel open/close transition (`.panel--open` slide)
- CSS Modules only, no inline styles
