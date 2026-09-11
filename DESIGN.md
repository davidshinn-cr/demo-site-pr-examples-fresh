# Quote-to-order design system

Official guidance reviewed September 11, 2026: https://www.coderabbit.ai/brand.

This is a product interface for an SA walking through a purchase on a shared screen. Dark mode is required by the maintainer. Restrained dark Mauve surfaces carry the content; CR Orange identifies the primary action.

- Reuse the reference demo-site palette: background #121014, sidebar #1A181D, surface #232127, hover #2B282F, border #3C3841, secondary text #B5B2B9, primary text #EFEDF0. CR Orange #FF570A, supporting Mint #25E2A8 and Cobalt #687FF5.
- Geist 400 for reading and controls; Geist 600 for headings. Hack 400 for amounts and IDs, Hack 700 for technical labels.
- Use the unchanged white logotype with proportional sizing and clear space. Asset provenance and licenses live in public/brand/README.md.
- Desktop: compact top bar, contextual left rail, purchase workspace and invoice list. Below 760px, stack content and collapse the rail into a horizontal context strip.
- Subtle borders, 8px controls, no decorative shadows. Orange actions use dark text for contrast.
- Visible focus, labeled inputs, readable error/status announcements, reduced-motion preference, and contained horizontal scrolling for tables.

Shared tokens live in src/styles.css. Reference assets were copied read-only from demo-site; that repository is not modified.
