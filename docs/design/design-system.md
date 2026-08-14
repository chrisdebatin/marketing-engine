# UI/UX Design System — Marketing-Engine / CRM

**Binding for all UI work in this repository.** Referenced from [AGENTS.md](../../AGENTS.md);
the webdesign subagent (`.claude/agents/webdesign.md`) applies these rules.

## Primary visual reference

**`docs/design/crm-ui-reference.png`** — inspect this image whenever making
significant UI changes. It is **more authoritative than generic contemporary
web-design trends**.

> If the PNG is missing at that path, ask the owner to add it. Until then, the
> description below captures it: a classic productivity-SaaS CRM dashboard on a
> near-white canvas. Persistent white left sidebar with icon+label items and a
> solid blue rounded rectangle marking the active page; red badge counters.
> Top bar with search, notifications, avatar. Content: a row of four white KPI
> cards (thin gray border, ~10px radius), each with a colored icon disc (blue,
> green, purple, orange), a 28–32px bold KPI value partly in the accent color,
> and a small green/red delta chip. Below: a white card with a simple blue bar
> chart with hover tooltip; a solid-blue promo card with white text and one
> white button; three equal white cards (task list with checkboxes and
> red/orange due-date accents · activity feed with small colored square icons ·
> pipeline overview as labeled colored progress bars with values). Bottom: a
> clean table (clear headers, subtle row separators, colored status pills,
> avatars, kebab row actions, "View all" link). Everything rectangular-ish,
> obvious, colorful against white — nothing decorative.

## Primary goal

**EXTREME EASE OF USE, GLANCEABILITY, SIMPLICITY AND INTUITIVENESS.**

A user should be able to look at any screen for 3 seconds and understand:
where they are · what the screen contains · what information is most
important · what they can click · what they should do next.

## Overall aesthetic

A polished **2018–2020 productivity SaaS application**, implemented with
modern engineering quality — think **classic Airtable + Asana + simple
invoicing/CRM SaaS**. It should feel like an **application**, not a website.

Visual language: **simple + poppy + structured + colorful + obvious +
friendly + professional**.

## Layout

- Plain white or extremely light cool-gray background
- Strong, obvious grid; white rectangular content boxes
- Clearly separated functional areas; predictable page layouts
- Persistent, simple sidebar navigation
- Consistent spacing; moderate information density
- Generous whitespace without wasting screen space
- Information always has an obvious visual home

## Cards / boxes

White rectangular boxes with 8–12px corner radius, thin subtle gray border,
very subtle shadow where useful, a clear heading, consistent padding and
strong internal hierarchy. Boxes represent meaningful groups of information.
No cards inside cards unnecessarily.

## Color

Color is a major part of the product identity. Keep the canvas mostly white
and let **bold saturated colors pop against it**: strong blue, emerald green,
purple, orange, coral/red, cyan, pink.

Use color intentionally for: important numbers, KPI values, icons, primary
buttons, selected navigation, statuses, tags, categories, charts, small
section accents. Color has **consistent semantic meaning** throughout the
app. Do NOT make the application mostly monochrome gray.

(Charts additionally follow the dataviz skill: palettes must be validated —
these two systems complement each other, dataviz wins on chart internals.)

## Typography

Clean sans-serif, extremely readable.

| Role | Size/weight |
|---|---|
| Page titles | 24–28px bold |
| Section titles | 16–18px semibold |
| KPI values | 26–34px bold |
| Standard UI text | 14–15px |
| Secondary information | 12–13px |

Important numbers are large and immediately recognizable. No oversized
marketing typography.

## Navigation

Persistent left sidebar. Items have icon + text label, clear spacing,
obvious hover state and an **extremely obvious active state** (strong colored
rectangular background with contrasting text/icon, as in the reference
image). Never rely exclusively on icons for important navigation.

## Dashboard philosophy

Understandable within ~3 seconds. Prioritize: important KPIs, pipeline,
performance, tasks requiring attention, recent activity, recent records,
simple charts. A dashboard answers **"What is happening?"** and **"What
needs my attention?"**. No decorative widgets that don't help a decision.

## Tables

Clean, structured, fast to scan, predictable, moderately information-dense.
Clear headers, strong alignment, subtle row separators, hover states,
colored statuses, search, filters, sorting, obvious row actions. Users scan
vertically and horizontally without visual confusion.

## Buttons and controls

Buttons look like buttons. Primary: solid saturated color, white text,
obvious hover/focus. Secondary: white/light background, border, dark text.
Corner radius ~6–10px. Do not turn every element into a pill.

## Interaction philosophy

Prefer familiar, obvious patterns: tables, tabs, dropdowns, forms,
checkboxes, modals, side panels, search, filters. Important actions are
visible; never hide essential functionality behind clever interactions. A
user should rarely wonder "What happens if I click this?"

## UX priority order (exact)

1. Ease of use
2. Glanceability
3. Clarity
4. Intuitiveness
5. Predictability
6. Speed
7. Consistency
8. Accessibility
9. Visual attractiveness
10. Novelty

If a visually impressive solution is harder to understand, **always choose
the simpler solution**.

## Do NOT use

No drift toward contemporary "AI startup" trends: glassmorphism / frosted
glass, dark futuristic UI, neon glow, mesh or excessive gradients, floating
decorative UI, excessive animation, giant border radii, pill-shaped
everything, huge marketing typography, abstract decorative backgrounds,
excessive shadows, low-contrast gray-on-gray, excessive whitespace, bento
layouts purely for aesthetics, hidden controls, overly minimalist interfaces
that sacrifice clarity.

## Core principle

**Do not confuse simplicity with minimalism.** The CRM may contain
substantial amounts of information; the design system's job is to make it
**feel simple because it is extremely well organized** — via structure,
alignment, boxes, typography, spacing and meaningful color.

### The 3-second test

If a user sees the screen for only three seconds, can they tell (1) what
page this is, (2) what the important information is, (3) what the primary
actions are? If not, simplify and restructure.

## Consistency

Reuse shared design-system components rather than independently styling
every screen. Keep consistent: sidebar, page headers (`PageHeader`), KPI
boxes, cards, tables, buttons (`ui/button`), inputs (`ui/input`), tags,
status badges, modals, empty states, charts, spacing, typography, color
semantics. When implementing new UI, first inspect existing shared
components and extend/reuse them.

## Existing functionality

Visual redesigns must NOT casually remove or alter working functionality.
Before changing a screen: inspect its current behavior, understand its data
and interactions, preserve functionality, and apply the design system
around it. Never simplify away functionality because it makes a screenshot
cleaner.
