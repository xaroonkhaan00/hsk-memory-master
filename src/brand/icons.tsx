/**
 * One line-drawn icon set, so the app does not lean on platform emoji.
 *
 * Every glyph is a 24×24 stroke path that inherits `currentColor`, which keeps
 * the whole interface consistent across Android, iOS and desktop — emoji are
 * drawn by the operating system and look different (and more cartoonish) on
 * each one.
 */
export type IconName =
  | 'home'
  | 'book'
  | 'film'
  | 'search'
  | 'chart'
  | 'repeat'
  | 'lifebuoy'
  | 'spark'
  | 'bolt'
  | 'star'
  | 'wave'
  | 'letters'
  | 'swords'
  | 'tree'
  | 'ruler'
  | 'palace'
  | 'walk'
  | 'link'
  | 'chat'
  | 'notebook'
  | 'grid'
  | 'trophy'
  | 'map'
  | 'grain';

const PATHS: Record<IconName, string> = {
  home: 'M3.6 10.4 12 4l8.4 6.4V19a1.4 1.4 0 0 1-1.4 1.4h-3.6v-5.6H8.6v5.6H5A1.4 1.4 0 0 1 3.6 19z',
  book: 'M4 5.2A1.2 1.2 0 0 1 5.2 4H10a2.6 2.6 0 0 1 2 1v13a2.6 2.6 0 0 0-2-1H5.2A1.2 1.2 0 0 1 4 15.8zM20 5.2A1.2 1.2 0 0 0 18.8 4H14a2.6 2.6 0 0 0-2 1v13a2.6 2.6 0 0 1 2-1h4.8a1.2 1.2 0 0 0 1.2-1.2z',
  film: 'M3.4 6.6A1.6 1.6 0 0 1 5 5h14a1.6 1.6 0 0 1 1.6 1.6v10.8A1.6 1.6 0 0 1 19 19H5a1.6 1.6 0 0 1-1.6-1.6zM3.4 9.4h17.2M9 5v4.4M15 5v4.4M9.8 12.6l4.4 2.4-4.4 2.4z',
  search: 'M11 4.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8zM15.8 15.8 20 20',
  chart: 'M4 20h16M7.2 20v-6.6M12 20V6.8M16.8 20v-9.4',
  repeat: 'M4.6 9.2A5.4 5.4 0 0 1 10 4.6h6.6M14.6 2.4 17.4 4.6l-2.8 2.2M19.4 14.8A5.4 5.4 0 0 1 14 19.4H7.4M9.4 21.6 6.6 19.4l2.8-2.2',
  lifebuoy: 'M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zM6.1 6.1l3.5 3.5M14.4 14.4l3.5 3.5M17.9 6.1l-3.5 3.5M9.6 14.4l-3.5 3.5',
  spark: 'M12 3.2l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.2l5.1-1.9zM18.4 16.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  bolt: 'M13.4 3.4 5.6 13.2h5L10 20.6l7.8-9.8h-5z',
  star: 'm12 4 2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z',
  wave: 'M3 12h2.2M7.4 12V7.6M11.8 12V4.4M16.2 12v-5M20.6 12h-1M3 16.4h18',
  letters: 'M4 18 8.2 6.4 12.4 18M5.6 14.2h5.2M16 10.2c2 0 3.4 1.2 3.4 3.2V18M19.4 14.4c-3.6-.6-5.4.6-5.4 2 0 1.1 1 1.8 2.2 1.8 1.6 0 3.2-1.2 3.2-2.6',
  swords: 'M4 4.6h3l9.4 9.4M20 4.6h-3L7.6 14M4.8 18.4l3.4-3.4M19.2 18.4l-3.4-3.4M3.4 19.8l1.4 1.4M20.6 19.8l-1.4 1.4',
  tree: 'M12 20v-5.4M12 14.6 7.6 11M12 14.6 16.4 11M12 11V4.6M7.6 11v3M16.4 11v3',
  ruler: 'M3.6 14.4 14.4 3.6l6 6L9.6 20.4zM7.2 10.8l1.8 1.8M10.2 7.8l1.8 1.8M13.2 4.8l1.8 1.8M4.8 13.2l1.8 1.8',
  palace: 'M4 20h16M5.4 20v-8M9.2 20v-8M14.8 20v-8M18.6 20v-8M3.4 12h17.2L12 4.4z',
  walk: 'M13.4 4.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM12.6 20l1.4-5-2.6-2.2.8-4.2 3.2 2.2 2.4.6M11.4 8.6 8.6 10l-1 3.4M12.6 15l-3.2 5',
  link: 'M10.2 13.8a3.6 3.6 0 0 0 5.2 0l2.6-2.6a3.6 3.6 0 0 0-5.2-5.2l-1.2 1.2M13.8 10.2a3.6 3.6 0 0 0-5.2 0L6 12.8a3.6 3.6 0 0 0 5.2 5.2l1.2-1.2',
  chat: 'M4 6.6A1.6 1.6 0 0 1 5.6 5h12.8A1.6 1.6 0 0 1 20 6.6v7.8a1.6 1.6 0 0 1-1.6 1.6H9.2L5 19.4v-3.4A1.6 1.6 0 0 1 4 14.4z',
  notebook: 'M6.4 4h11.2a1.4 1.4 0 0 1 1.4 1.4v13.2a1.4 1.4 0 0 1-1.4 1.4H6.4A1.4 1.4 0 0 1 5 18.6V5.4A1.4 1.4 0 0 1 6.4 4zM5 8.4h3M5 12h3M5 15.6h3M11 8.6h5M11 12.2h5',
  grid: 'M4.6 4.6h6v6h-6zM13.4 4.6h6v6h-6zM4.6 13.4h6v6h-6zM13.4 13.4h6v6h-6z',
  trophy: 'M7.6 4.4h8.8v4.4a4.4 4.4 0 1 1-8.8 0zM7.6 6h-2.6a2.4 2.4 0 0 0 2.6 3.4M16.4 6H19a2.4 2.4 0 0 1-2.6 3.4M12 13.2V17M8.8 20h6.4l-.8-3H9.6z',
  map: 'M3.6 6.6 9 4.6l6 2 5.4-2v12.8l-5.4 2-6-2-5.4 2zM9 4.6v12.8M15 6.6v12.8',
  grain: 'M12 3.6v16.8M12 8c2-2.6 4.4-3 6-2.6.2 2.2-1.2 4.6-3.6 5.4-1 .3-1.8.3-2.4.2M12 13.4c-2-2.6-4.4-3-6-2.6-.2 2.2 1.2 4.6 3.6 5.4 1 .3 1.8.3 2.4.2',
};

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
