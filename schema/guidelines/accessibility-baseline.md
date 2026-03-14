# Accessibility Baseline

Lint catches contrast ratios and target sizes, but these design decisions can't be automated.

## Don't Rely on Color Alone

- Status indicators need text or icon support, not just a color dot
- Error states need labels, not just red fills
- Selected items should be distinguishable without color vision

## Text Hierarchy

- Body text: 14px minimum, sufficient contrast against background
- Muted/tertiary text: still readable, not decorative
- Don't create hierarchy through tiny font size differences alone

## Interactive Targets

- Buttons and controls: at least 44x44 touch target
- Don't create tiny pills that only look clickable
- Compact UI still needs usable hit areas

## Forms

- Every input needs a visible label (not just placeholder text)
- Error and helper text should be present, not implied
- Field boundaries must be visible

Run `lint(method: "check", rules: ["wcag"])` to catch measurable violations. The rules above cover what lint can't measure.
