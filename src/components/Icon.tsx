export function Icon({
  name,
}: {
  name: "arrow" | "expand" | "check" | "radar" | "bolt" | "reset" | "trophy" | "volume" | "muted";
}) {
  const paths = {
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    expand: (
      <>
        <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    radar: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <path d="m12 12 7-7" />
      </>
    ),
    bolt: <path d="m13 2-8 12h6l-1 8 9-13h-7z" />,
    reset: (
      <>
        <path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 21h8m-4-4v4M7 4h10v6a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v2a4 4 0 0 0 3 4m10-6h3v2a4 4 0 0 1-3 4" />
      </>
    ),
    volume: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7m2.8-9.8a9 9 0 0 1 0 12.6" />
      </>
    ),
    muted: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="m16 9 5 6m0-6-5 6" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
