type SocialPlatform = 'Facebook' | 'Instagram' | 'LinkedIn';

/** Social glyphs inherit the site's brand colour rather than platform colours. */
export default function SocialIcon({ platform }: { platform: SocialPlatform }) {
  return <svg className="icon social-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    {platform === 'Instagram' ? <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.1" />
    </> : platform === 'Facebook' ? <path d="M14 22v-9h3l.5-3.5H14V7.3c0-1 .3-1.8 1.8-1.8h1.9V2.3c-.4-.1-1.6-.3-2.9-.3-2.9 0-4.8 1.8-4.8 5v2.5H7V13h3v9h4Z" /> : <>
      <circle cx="5" cy="5" r="2" />
      <path d="M3.2 8.5h3.6V21H3.2zM9.5 8.5H13v1.7c.5-1 1.7-2 3.7-2 3.9 0 4.3 2.5 4.3 5.8v7h-3.6v-6.2c0-1.5 0-3.4-2-3.4s-2.3 1.6-2.3 3.3V21H9.5V8.5Z" />
    </>}
  </svg>;
}
