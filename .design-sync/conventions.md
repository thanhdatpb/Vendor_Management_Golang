# HappC Design System — Conventions

## Wrapping & Setup

No provider or root wrapper required — tokens are pure CSS custom properties loaded via `styles.css`.
Always import `styles.css` (which pulls in Nunito + Nunito Sans from Google Fonts, all tokens, and base component CSS):

```html
<link rel="stylesheet" href="styles.css">
```

## Styling Idiom

This is an **inline-CSS design system** — no utility classes, no class-name vocabulary.
Style every element with `style={{ ... }}` using CSS custom property values from `tokens/tokens.css`.

```jsx
// Correct — use CSS custom properties
<div style={{ background: 'var(--hc-orange)', borderRadius: 'var(--hc-radius-lg)' }}>

// Wrong — never hardcode hex values from this DS
<div style={{ background: '#F5A623' }}>
```

All token names follow `--hc-*`. The full set lives in `tokens/tokens.css`.

## Key Tokens At a Glance

| Purpose | Token |
|---|---|
| Primary brand | `var(--hc-orange)` → #F5A623 |
| Brand gradient | `linear-gradient(135deg, var(--hc-orange) 0%, var(--hc-orange-deep) 100%)` |
| Primary text | `var(--hc-ink)` → #1A0F00 |
| Card background | `var(--hc-surface)` → #FFFFFF |
| Default border | `1.5px solid var(--hc-border-strong)` |
| Card radius | `var(--hc-radius-lg)` → 16px |
| Pill (button) | `var(--hc-radius-pill)` → 9999px |
| Card shadow | `var(--hc-shadow)` |
| Heading font | `var(--hc-font-heading)` → Nunito |
| Body font | `var(--hc-font-body)` → Nunito Sans |

## Where the Truth Lives

- **All tokens:** `tokens/tokens.css`
- **Component CSS helpers:** `_ds_bundle.css`
- **Color reference:** `components/Tokens/Colors/Colors.prompt.md`
- **Typography scale:** `components/Tokens/Typography/Typography.prompt.md`
- **Borders & spacing:** `components/Tokens/Borders/Borders.prompt.md`

## Idiomatic Build Snippet

```jsx
// HappC card with primary button
<div style={{
  background: 'var(--hc-surface)',
  border: '1.5px solid var(--hc-border-strong)',
  borderRadius: 'var(--hc-radius-lg)',
  boxShadow: 'var(--hc-shadow)',
  padding: 'var(--hc-space-5)',
}}>
  <h3 style={{
    fontFamily: 'var(--hc-font-heading)',
    fontSize: 15, fontWeight: 800,
    color: 'var(--hc-ink)', margin: '0 0 8px',
  }}>Title</h3>
  <p style={{
    fontFamily: 'var(--hc-font-body)',
    fontSize: 14, color: 'var(--hc-ink-2)', margin: 0,
  }}>Body text</p>
  <button style={{
    marginTop: 16,
    background: 'linear-gradient(135deg, var(--hc-orange) 0%, var(--hc-orange-deep) 100%)',
    color: '#fff', border: 'none',
    borderRadius: 'var(--hc-radius-pill)',
    padding: '10px 20px',
    fontFamily: 'var(--hc-font-heading)', fontWeight: 700, cursor: 'pointer',
  }}>Confirm</button>
</div>
```
