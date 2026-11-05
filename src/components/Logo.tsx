/** The Team Hub mark: a red paddle and a white ball on a navy tile (the same drawing as public/icon.svg). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="15" fill="#102a63" />
      <rect x="-5" y="0" width="10" height="23" rx="4.5" fill="#ffffff" transform="translate(33.5 34.5) rotate(-45)" />
      <circle cx="26.5" cy="27.5" r="16" fill="#e0352f" />
      <circle cx="48.5" cy="14.5" r="6.5" fill="#ffffff" />
    </svg>
  );
}
