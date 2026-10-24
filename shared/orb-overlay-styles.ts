/** Collapsed orb hit target / window size (matches OrbShell button). */
export const ORB_VISIBLE_DIAMETER_PX = 96

/** CSS rules applied to the overlay renderer for a fully transparent window background. */
export const ORB_OVERLAY_TRANSPARENT_CSS = [
  'html, body, #root { background: transparent !important; }',
  '#root { display: flex; align-items: flex-end; justify-content: flex-end; }',
  'button.orb-hit-target { background: transparent; -webkit-appearance: none; appearance: none; }'
].join('\n')
