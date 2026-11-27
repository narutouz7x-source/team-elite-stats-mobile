# OG ELITE Stats — Unslop project direction

This project uses the Unslop design skill by Damir Sokolovsky. Unslop is licensed under CC BY 4.0; retain attribution to Damir Sokolovsky (@heydamir) and link to https://github.com/heydamir/unslop in any copied or adapted skill material.

## Product direction

- **Product:** OG ELITE Stats is a mobile esports performance companion for tracking team results, player performance, tournament history and community clips.
- **Character:** competitive, precise, composed.
- **World:** esports broadcast and match telemetry — graphite equipment, clean broadcast overlays, real player photography and legible performance data.
- **Moments:** the team performance / kills progression chart; authentic player portraits and match-result details.
- **Signature:** a restrained tournament-stage and rank indicator that makes the current competitive context immediately clear.

## Brand and visual constraints

- Preserve the established palette: Glacier Grey `#DDE5EC`, Charcoal `#1E2226`, Safety Orange `#FF5A1F`.
- Safety Orange is reserved for interactive elements and active controls. Do not use it as decorative glow, large background wash, non-interactive text, or indiscriminate chart color.
- Keep surfaces neutral and quiet. Use the charcoal/grey ramp for page, card, raised and border roles; maintain readable primary, secondary and muted text.
- Preserve the existing OG ELITE identity, logo assets, real player images and the product's esports character. Do not add an unrelated aesthetic or generic dashboard template.
- Do not add dark text backplates/tags behind ordinary text on cards or bubbles. Text should sit directly on its intended surface unless a control genuinely needs a container.
- Do not add gradients, colored glows, blurred color blobs, neon borders, decorative emoji, or gratuitous animation.
- Keep the user's requested liquid-glass navigation treatment only where it already serves the navigation interaction; do not spread glass effects across every card or surface.
- Use one consistent icon family (the project already uses lucide-react), restrained icon sizing, sentence-case labels, consistent spacing and tabular numerals for stats.
- Keep player images free of added “OG” text overlays.
- Do not use navy or blue accents. Do not introduce lime or purple.
- Maintain strong mobile readability and touch targets; avoid excessive side margins and cramped two-column player rows.

## Product and implementation constraints

- This is a refinement of the existing app, not a feature rewrite. Preserve data flow, API contracts, navigation, tournament/stage logic, match history, player stats, clips, notifications, ads and Android widget integration.
- Do not remove or rename existing features unless the user explicitly requests it.
- Do not invent player data, stats, tournament claims or creator content.
- Keep all work on `feature/liquid-core-mobile-redesign`. Never commit to `main`, merge, or deploy to production as part of a design pass.
- Work screen by screen and complete an audit before editing. If a screen is already well designed, make only the small fixes supported by the audit.
- After each pass, run `npm run build` and fix TypeScript/build regressions. Do not claim a build passed unless it was actually run.
- Before finalizing, compare rendered mobile screenshots at realistic phone dimensions, check light/dark contrast where applicable, and verify navigation, sheets, add-clip flow, charts and player profiles.
- Report the exact files changed, visual decisions, build/test results and any remaining issues.

## Unslop execution

Use the official Unslop skill workflow: audit first; present the five-line direction above; then work through spacing, color, icons, copy, typography, layout, details, visuals and motion in order; render and compare; finish with the Unslop checklist. Do not redesign merely to make the screen different.

Unslop project: https://github.com/heydamir/unslop
