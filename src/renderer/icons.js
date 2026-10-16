/* Ikonky (20×20, farba podľa textu). Použitie: ICONS.svg('brush') */
window.ICONS = (function () {
  const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const P = {
    cloud: `<path ${S} d="M6 15.5h8.2a3.3 3.3 0 0 0 .4-6.6A4.8 4.8 0 0 0 5.4 8 3.8 3.8 0 0 0 6 15.5z"/><path ${S} d="M10 9.6v4.2M8.2 11.9l1.8 1.9 1.8-1.9"/>`,
    bulb: `<path ${S} d="M7.2 13.6c-1.6-1.1-2.7-2.9-2.7-5A5.5 5.5 0 0 1 10 3a5.5 5.5 0 0 1 5.5 5.6c0 2.1-1.1 3.9-2.7 5v1.4H7.2z"/><path ${S} d="M7.8 17h4.4"/>`,
    palette: `<path ${S} d="M10 2.8a7.2 7.2 0 1 0 0 14.4c1 0 1.5-.6 1.5-1.4 0-1.2-1-1.4-1-2.4 0-.9.7-1.5 1.6-1.5h1.8a3.3 3.3 0 0 0 3.3-3.3C17.2 5.4 14 2.8 10 2.8z"/><circle cx="6.6" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="6.2" r="1.1" fill="currentColor"/><circle cx="12.6" cy="6.6" r="1.1" fill="currentColor"/>`,
    newjob: `<path ${S} d="M5 2.8h6.5L15 6.3v10.9H5z"/><path ${S} d="M11.3 2.8v3.7H15M10 9.5v5M7.5 12h5"/>`,
    folder: `<path ${S} d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.6l1.8 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z"/>`,
    clock: `<circle ${S} cx="10" cy="10.5" r="6.8"/><path ${S} d="M10 6.6v4.1l2.6 1.6"/>`,
    film: `<rect ${S} x="2.8" y="3.5" width="14.4" height="13" rx="2.2"/><path ${S} d="M6.3 3.5v13M13.7 3.5v13M2.8 7.8h3.5M2.8 12.2h3.5M13.7 7.8h3.5M13.7 12.2h3.5"/>`,
    target: `<circle ${S} cx="10" cy="10" r="7"/><circle ${S} cx="10" cy="10" r="3.6"/><circle cx="10" cy="10" r="1.1" fill="currentColor"/>`,
    bell: `<path ${S} d="M5 13.8V9.2a5 5 0 0 1 10 0v4.6l1.4 1.6H3.6z"/><path ${S} d="M8.3 17.2a1.9 1.9 0 0 0 3.4 0"/>`,
    phone: `<rect ${S} x="5.5" y="2.5" width="9" height="15" rx="2.2"/><path ${S} d="M9 15h2"/>`,
    chip: `<rect ${S} x="5" y="5" width="10" height="10" rx="2"/><path ${S} d="M8 2.5v2.5M12 2.5v2.5M8 15v2.5M12 15v2.5M2.5 8h2.5M2.5 12h2.5M15 8h2.5M15 12h2.5"/><path ${S} d="M8.2 11.8l1.8-3.6 1.8 3.6M8.8 10.7h2.4"/>`,
    spark: `<path ${S} d="M10 2.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/><path ${S} d="M15.5 13.2c.2 1.4.8 2 2.2 2.2-1.4.2-2 .8-2.2 2.2-.2-1.4-.8-2-2.2-2.2 1.4-.2 2-.8 2.2-2.2z"/>`,
    keyboard: `<rect ${S} x="2.5" y="5" width="15" height="10" rx="2"/><path ${S} d="M5.5 8.3h.1M8.5 8.3h.1M11.5 8.3h.1M14.5 8.3h.1M6.5 11.8h7"/>`,
    shield: `<path ${S} d="M10 2.6l6 2.3v4.4c0 3.9-2.6 6.6-6 8.1-3.4-1.5-6-4.2-6-8.1V4.9z"/><path ${S} d="M7.4 10l1.8 1.8 3.4-3.6"/>`,
    info: `<circle ${S} cx="10" cy="10" r="7"/><path ${S} d="M10 9v4.6M10 6.4v.1"/>`,
    brush: `<path ${S} d="M16.6 3.4c-1.9.4-6.1 4.4-7.5 6.4l1.1 1.1c2-1.4 6-5.6 6.4-7.5z"/><path ${S} d="M8.6 10.5c-1.8-.2-3.3 1-3.4 2.9-.1 1.4-.7 2.2-1.7 2.6 2.6 1 6.2.4 6.5-2.6"/>`,
    pen: `<path ${S} d="M13.8 3.5l2.7 2.7-9.3 9.3-3.6.9.9-3.6z"/><path ${S} d="M12 5.3l2.7 2.7"/>`,
    marker: `<path ${S} d="M12.3 3.6l4.1 4.1-6.8 6.8H5.5v-4.1z"/><path ${S} d="M3.5 17h7"/>`,
    eraser: `<path ${S} d="M8.2 16.5l-4.1-4.1a1.4 1.4 0 0 1 0-2l6.7-6.7a1.4 1.4 0 0 1 2 0l3.2 3.2a1.4 1.4 0 0 1 0 2l-7 7.6zM8.2 16.5H17M6.4 8.1l5.5 5.5"/>`,
    line: `<path ${S} d="M4 16L16 4"/>`,
    arrow: `<path ${S} d="M4 16L16 4M9.5 4H16v6.5"/>`,
    rect: `<rect ${S} x="3.5" y="5" width="13" height="10" rx="1.5"/>`,
    ellipse: `<ellipse ${S} cx="10" cy="10" rx="7" ry="5.5"/>`,
    undo: `<path ${S} d="M7.5 6.5L4 10l3.5 3.5"/><path ${S} d="M4.5 10h7.5a4 4 0 0 1 0 8h-2"/>`,
    redo: `<path ${S} d="M12.5 6.5L16 10l-3.5 3.5"/><path ${S} d="M15.5 10H8a4 4 0 0 0 0 8h2"/>`,
    grid: `<rect ${S} x="3" y="3" width="14" height="14" rx="1.5"/><path ${S} d="M7.7 3v14M12.3 3v14M3 7.7h14M3 12.3h14"/>`,
    image: `<rect ${S} x="2.8" y="3.8" width="14.4" height="12.4" rx="2"/><circle cx="7.3" cy="8" r="1.4" fill="currentColor"/><path ${S} d="M3.5 14.5l4.2-4 3.2 3 2.3-2.2 3.6 3.4"/>`,
    trash: `<path ${S} d="M4 6h12M8 6V4.2h4V6M5.5 6l.8 10.5h7.4L14.5 6M8.5 9v5M11.5 9v5"/>`,
    pin: `<path ${S} d="M12.6 3l4.4 4.4-2.3.8-3 3 .4 3.3-1.4 1.4-2.6-2.6-3.6 3.6M7 11.1L4.4 8.5l1.4-1.4 3.3.4 3-3z"/>`,
    tag: `<path ${S} d="M3 3h6.3l7.7 7.7-6.3 6.3L3 9.3z"/><circle cx="6.6" cy="6.6" r="1.2" fill="currentColor"/>`,
    link: `<path ${S} d="M8.6 11.4a3.2 3.2 0 0 0 4.5 0l2.6-2.6a3.2 3.2 0 0 0-4.5-4.5l-1 1"/><path ${S} d="M11.4 8.6a3.2 3.2 0 0 0-4.5 0l-2.6 2.6a3.2 3.2 0 0 0 4.5 4.5l1-1"/>`,
    copy: `<rect ${S} x="6.5" y="6.5" width="10" height="10" rx="2"/><path ${S} d="M13.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/>`,
    download: `<path ${S} d="M10 3.5v9M6.3 9l3.7 3.7L13.7 9M4 16.5h12"/>`,
    plus: `<path ${S} d="M10 4.5v11M4.5 10h11"/>`,
    storyboard: `<rect ${S} x="2.5" y="3.5" width="6.5" height="5" rx="1.2"/><rect ${S} x="11" y="3.5" width="6.5" height="5" rx="1.2"/><rect ${S} x="2.5" y="11.5" width="6.5" height="5" rx="1.2"/><rect ${S} x="11" y="11.5" width="6.5" height="5" rx="1.2"/>`,
    note: `<path ${S} d="M4.5 3h11v14h-11z"/><path ${S} d="M7.5 7h5M7.5 10h5M7.5 13h3"/>`,
    left: `<path ${S} d="M12 4.5L6.5 10l5.5 5.5"/>`,
    right: `<path ${S} d="M8 4.5l5.5 5.5L8 15.5"/>`,
    check: `<path ${S} d="M4.5 10.5l3.5 3.5 7.5-8"/>`,
    calendar: `<rect ${S} x="3" y="4.2" width="14" height="12.8" rx="2"/><path ${S} d="M3 8.5h14M7 2.8v3M13 2.8v3"/>`,
    flame: `<path ${S} d="M10 17.2c3 0 5-2 5-4.9 0-3.2-2.6-4.6-3.3-8.1-1.6 1.4-2.2 3.2-2 4.7-1.2-.5-2-1.7-2.1-2.9C6.1 7.4 5 9.4 5 12.3c0 2.9 2 4.9 5 4.9z"/>`,
    search: `<circle ${S} cx="9" cy="9" r="5.5"/><path ${S} d="M13.2 13.2L17 17"/>`,
    duplicate: `<rect ${S} x="6.5" y="6.5" width="10" height="10" rx="2"/><path ${S} d="M11.5 9.5v4M9.5 11.5h4M13.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/>`,
    sparkle: `<path ${S} d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z"/>`,
    play: '<path d="M6.5 4.3v11.4c0 .6.7 1 1.2.6l8.5-5.7c.5-.3.5-1 0-1.3L7.7 3.7c-.5-.4-1.2 0-1.2.6z" fill="currentColor"/>',
    rocket: `<path ${S} d="M11.5 13.5l-5-5c1.6-3.6 4.6-5.8 9.5-6 -.2 4.9-2.4 7.9-6 9.5z"/><path ${S} d="M7.7 9.7L4.3 9.4l2.1-2.6 2.8.4M10.3 12.3l.3 3.4 2.6-2.1-.4-2.8"/><circle cx="12.6" cy="7.4" r="1.2" fill="currentColor"/><path ${S} d="M5.2 13.2c-1.1.6-1.6 2.1-1.7 3.3 1.2-.1 2.7-.6 3.3-1.7"/>`
  };
  function svg(name, cls) {
    return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 20 20" aria-hidden="true">${P[name] || P.info}</svg>`;
  }
  return { svg, has: n => !!P[n], names: Object.keys(P) };
})();
