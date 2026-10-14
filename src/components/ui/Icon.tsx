import React from 'react';

export type IconType =
  | 'globe' | 'study' | 'document' | 'people' | 'case' | 'shield'
  | 'folder' | 'check' | 'screen' | 'phone' | 'mail' | 'clock' | 'pin' | 'calendar';

const paths: Record<string, string> = {
  globe: '<circle cx="24" cy="24" r="18"/><ellipse cx="24" cy="24" rx="8" ry="18"/><path d="M7 18h34M7 30h34"/>',
  study: '<path d="m3 17 21-10 21 10-21 10L3 17Zm8 5v13q13 10 26 0V22M44 19v15"/>',
  document: '<rect x="11" y="5" width="27" height="38" rx="3"/><path d="M18 15h13M18 23h13M18 31h8"/>',
  people: '<circle cx="18" cy="15" r="7"/><path d="M5 40v-5a13 13 0 0 1 26 0v5M31 9a7 7 0 0 1 0 14M36 28q8 2 8 12"/>',
  case: '<rect x="5" y="15" width="38" height="27" rx="3"/><path d="M16 15V7h16v8M5 25q19 12 38 0M21 28h6v7h-6Z"/>',
  shield: '<path d="m24 4 17 7v13q0 12-17 20Q7 36 7 24V11L24 4Z"/><path d="m15 24 6 6 12-14"/>',
  folder: '<path d="M4 39V10h15l5 7h20v22H4Z"/><path d="M4 23h40"/>',
  check: '<circle cx="24" cy="24" r="19"/><path d="m14 24 7 7 14-15"/>',
  screen: '<rect x="4" y="7" width="40" height="28" rx="3"/><path d="M15 43h18M24 35v8M13 17h22M13 24h15"/>',
  phone: '<path d="m10 5 9 10-5 7q4 8 12 12l7-5 10 9q-2 8-10 6C17 40 7 30 4 15q-2-8 6-10Z"/>',
  mail: '<rect x="4" y="9" width="40" height="30" rx="3"/><path d="m5 11 19 15 19-15"/>',
  clock: '<circle cx="24" cy="24" r="19"/><path d="M24 12v13l9 5"/>',
  pin: '<path d="M38 19c0 12-14 25-14 25S10 31 10 19a14 14 0 0 1 28 0Z"/><circle cx="24" cy="19" r="5"/>',
  calendar: '<rect x="6" y="9" width="36" height="33" rx="4"/><path d="M6 19h36M16 5v8M32 5v8M15 27h4M22 27h4M29 27h4M15 34h4M22 34h4"/>',
};

interface IconProps {
  type?: IconType;
  className?: string;
}

export default function Icon({ type = 'globe', className }: IconProps) {
  const d = paths[type] || paths.globe;
  return (
    <svg
      className={className || 'icon'}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}
