---
name: design-reference
description: Canonical visual specs for the Josi Pilates studio-home live as standalone HTML mockups in design-reference/
metadata:
  type: reference
---

The `design-reference/` folder at the repo root holds hand-authored HTML/CSS mockups that are the canonical visual spec for the public landing page (`.studio-home-site` scope). When building or fixing a section component (e.g. `ScheduleSection`), the matching mockup shows the intended mobile + desktop layout, tokens, and states.

- Example: `design-reference/Agenda de Aulas - Conceito.html` = spec for `src/components/ScheduleSection.jsx` (day tabs, status pills aberta/ultima_vaga/lotada, WhatsApp CTA, 3-col desktop grid).
- The public landing page CSS lives in `src/index.css` scoped under `.studio-home-site { ... }` using native CSS nesting; design tokens are CSS vars (`--paper`, `--line`, `--ink`, `--brand-*`) redefined for dark mode under `.dark .studio-home-site`.

**How to apply:** Read the matching mockup before changing a landing-page section to match the intended visual, rather than inventing layout.
