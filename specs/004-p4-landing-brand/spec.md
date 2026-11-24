# Spec: P4 landing brand (#188–#190)

## Goals
1. Brand-first landing hero (MassageGo hero-level; one composition).
2. Distinct display + body fonts via Next font pipeline (Cyrillic + Latin).
3. Anonymous marketing chrome hides Admin; `/admin/login` remains direct.

## Non-goals
Portal UX redesign beyond header visibility; content marketing sections.

## Acceptance
- Removing nav still leaves recognizable MassageGo on first viewport.
- Display ≠ body (or justified); no Roboto-only stack; no CLS from FOIT.
- Anonymous landing header is client-appropriate; Admin not in marketing nav.
