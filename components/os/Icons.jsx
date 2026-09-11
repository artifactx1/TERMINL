export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    arcade: <><path d="M8 3h8l2 9 3 7v2H3v-2l3-7z" /><path d="M8 6h8v6H8zM7 17h4m-2-2v4m7-3h.01M18 18h.01" /></>,
    trophy: <><path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 0h8" /></>,
    shop: <><path d="M3 9l2-6h14l2 6M4 12v9h16v-9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 21v-6h6v6" /></>,
    terminal: <><rect x="3" y="3" width="18" height="14" rx="1" /><path d="M7 7l3 3-3 3m6 0h4m-5 4v4m-5 0h10" /></>,
    bolt: <path d="M13 2L4 14h7l-1 8 10-13h-8z" />,
    swords: <><path d="M3 3l6 2 11 13-2 2L5 9zM14 17l6-6M21 3l-6 2-4 5m-4 3-3 5 2 2 5-5M4 11l6 6" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    sound: <><path d="M11 4L6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    mute: <><path d="M11 4L6 8H3v8h3l5 4zM16 9l6 6m0-6-6 6" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01" /></>,
    share: <><path d="M12 16V3m-5 5 5-5 5 5M5 13H3v8h18v-8h-2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" {...props}>{paths[name] || paths.terminal}</svg>;
}
