# Design decisions

## Fluid as background
Chosen to make the site memorable and interactive without pulling focus from your story. The control panel (dat.gui) is hidden in embed mode so the experience stays clean. The fluid sim is vendored in `src/fluid/` and `public/fluid/` so we can tune colors/performance and keep the MIT license notice.

## Follow + run-away cursor quirks
Small decorative elements (dots that follow the cursor, dots that run away when the cursor is near) add personality and match the tone of the copy. Implemented with one global `mousemove` listener and CSS `transform` for smooth motion. **prefers-reduced-motion: reduce** disables these quirks for accessibility.

## Content: styling only
AboutMe text is used exactly as written in `docs/AboutMe.md`. No rewriting or restructuring. Only the contact line is turned into real links (email, GitHub, LinkedIn) using the URLs already in the doc; wording is unchanged.
