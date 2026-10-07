// The chat tile's page-global stylesheet, injected once into <head>: the bubble
// lives on <body>, outside any panel, so these rules cannot be scoped to one.
// Every rule is under #n8n-chat, .n8n-chat-widget or .n8n-chat-*, except the
// kiosk footer fix.
//
// The colour literals are deliberate. @n8n/chat renders light even on a dark
// Grafana, so its insides are pinned to light values, and the state card binds to
// the widget's own --chat--* properties rather than to the page's theme.

const parts = [
  // Kiosk embeds: the "Powered by" footer is sticky inside a container fixed to
  // the first viewport height, so it floats up once the page scrolls.
  `[data-testid="public-dashboard-footer"]{position:fixed!important;left:0;right:0;bottom:0}`,
  `#n8n-chat .chat-window-wrapper,.n8n-chat-widget{z-index:2147483647!important}`,

  // Size. The widget defaults to 400x600 with no media queries. On a desktop the
  // window's top sits under Grafana's controls row, measured into --n8n-chat-top by
  // the mount (these are fallbacks); --n8n-chat-reserve is what sits below the
  // window inside the widget's fixed wrapper (toggle, gap, inset).
  `#n8n-chat{--n8n-chat-top:14px;--n8n-chat-reserve:92px;` +
    `--chat--window--width:min(760px,calc(100vw - 2rem));` +
    `--chat--window--height:max(320px,calc(100vh - var(--n8n-chat-top) - var(--n8n-chat-reserve)))}`,
  // flex-end: the wrapper is a column of window then toggle, and a closed chat
  // hides the window with display:none, so without it the toggle rides up to the
  // controls row. It also makes an overlong window grow upwards.
  `#n8n-chat .chat-window-wrapper{top:var(--n8n-chat-top);justify-content:flex-end}`,
  // Narrow: full bleed. The mount stops setting the inline properties below 900px.
  `@media (max-width:900px){#n8n-chat{--chat--window--width:calc(100vw - 1.5rem);--chat--window--height:calc(100vh - 5rem)}}`,

  // Overflow: pod names, image refs and URLs have no break opportunity, and
  // break-word will not break a token on a line that already has content.
  `#n8n-chat .chat-message-markdown{overflow-wrap:anywhere}`,
  `#n8n-chat .chat-message-from-bot{max-width:94%}`,
  // Code and tables scroll rather than wrap: a wrapped command copies wrong.
  `#n8n-chat .chat-message-markdown pre,#n8n-chat .chat-message-markdown table{display:block;max-width:100%;overflow-x:auto}`,
  `#n8n-chat .chat-message-markdown pre code{overflow-wrap:normal;white-space:pre}`,
  `#n8n-chat .chat-message-markdown table{border-collapse:collapse;font-size:12px;white-space:nowrap}`,
  `#n8n-chat .chat-message-markdown th,#n8n-chat .chat-message-markdown td{border:1px solid var(--chat--color-light-shade-100,#d4d8dd);padding:3px 8px;text-align:left}`,
  `#n8n-chat .chat-message-markdown img{max-width:100%;height:auto}`,

  // Code contrast: Grafana's dark theme styles <code>/<pre> near-white globally,
  // which wins inside the light bubble. Elements only, so highlight.js spans keep
  // their colours.
  `#n8n-chat{--chat--message--pre--background:#f6f8fa}`,
  `#n8n-chat .chat-message-markdown pre,#n8n-chat .chat-message-markdown code{color:#1f2328!important;background:#f6f8fa}`,
  `#n8n-chat .chat-message-markdown pre{border:1px solid #d0d7de}`,
  `#n8n-chat .chat-message-markdown :not(pre)>code{background:#eaeef2;border:1px solid #d0d7de;border-radius:4px;padding:1px 5px;font-size:.92em}`,

  // Grafana styles every <textarea> globally: dark background, dark chat text.
  // -webkit-text-fill-color overrides color on WebKit.
  `#n8n-chat textarea{background:#fff!important;color:#14161a!important;-webkit-text-fill-color:#14161a!important;caret-color:#14161a!important;border:1px solid #c7ccd1!important;opacity:1!important}`,
  `#n8n-chat textarea::placeholder{color:#6b7280!important;-webkit-text-fill-color:#6b7280!important;opacity:1!important}`,
  `#n8n-chat .chat-input-send-button{color:#14161a!important}`,

  `.n8n-chat-tile{display:block;text-align:center;text-decoration:none;padding-top:6px;color:inherit}`,
  `.n8n-chat-tile .icon{font-size:30px;line-height:1;height:30px}`,
  `.n8n-chat-tile img{height:30px}`,
  `.n8n-chat-tile .label{font-size:12px;opacity:.75;margin-top:6px}`,

  // The state card. Colours come from the widget's own properties: .chat-body
  // inherits Grafana's dark-theme text colour, which measured 1.5:1 on the bubble.
  `.n8n-chat-state{display:flex;flex-wrap:wrap;align-items:center;gap:5px 6px;margin:10px 0 0;padding:8px 0 0;` +
    `border-top:1px solid var(--chat--color-medium,#d2d4d9);color:var(--chat--color-dark,#101330);font-size:12px;line-height:1.4}`,
  // With no reply to hang under, the card carries its own edges.
  `.n8n-chat-state.ncs-loose{margin:2px 0 10px;padding:8px 10px;border:1px solid var(--chat--color-medium,#d2d4d9);` +
    `border-left:3px solid #5794f2;border-radius:4px;background:var(--chat--message--bot--background,#fff)}`,
  `.n8n-chat-state .ncs-head{width:100%;margin-bottom:2px;font-size:11px;font-weight:600;letter-spacing:.02em;opacity:.62}`,
  `.n8n-chat-state .ncs-chip{display:inline-flex;align-items:baseline;gap:6px;margin:0;padding:3px 9px;border-radius:11px;` +
    `border:1px solid var(--chat--color-medium,#d2d4d9);background:var(--chat--color-light,#f2f4f8);font:inherit;color:inherit}`,
  `.n8n-chat-state .ncs-chip b{font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.05em;opacity:.62}`,
  `.n8n-chat-state .ncs-chip i{font-style:normal}`,
  `.n8n-chat-state button.ncs-go{cursor:pointer}`,
  `.n8n-chat-state button.ncs-go:hover{border-color:#5794f2;background:rgba(87,148,242,.12)}`,
];

export const STYLES = parts.join('\n');
