1. *Refactor binder slot editing modal form in `docs/binders.html` and `docs/js/binders.js`.*
   - Remove modal header title text ("Detalle de Carta") and remove all placeholder text from form input fields.
   - Hide the "URL Imagen" text input field.
   - Implement real-time live typing search on `#external-search-input` without requiring a "Buscar" button, rendering an expanded scrollable results container.
   - Replace cyan/green gradient glows on tabs and save button with clean, elegant purple styling (`background: #8b5cf6`, `color: #fff`).
   - Fix modal vertical max-height and scrolling to ensure `#btn-save-slot` remains fully visible without being cut off.
   - Fix empty card slot aspect ratios in `binders.html` grid preview so empty slots maintain rectangular card proportions (3:4 aspect ratio).

2. *Fix public link turn.js page flip layout offsets and card rendering in `docs/js/app.js`.*
   - Ensure `renderBinder` fetches all `binder_card_slots` and renders cards, page subtotals, and binder total badges accurately.
   - Refine `turn.js` initialization parameters, container dimensions, and `turned`/`turning` event handlers in `renderBinder` to eliminate layout shifts/desfases when flipping pages backwards.

3. *Verify changes using Playwright tests and complete pre-commit steps.*
   - Verify layout and functionality visually using Playwright screenshots.
   - Complete pre-commit checklist steps before submission.

4. *Submit final changes.*
   - Submit changes with a clear commit message.