export const metadata = {
  title: "YoungFreedom — Verified jobs for Bihar's youth",
  description: "YoungFreedom connects Bihar's skilled youth with verified industrial jobs across India."
};

/**
 * Wraps every page, including the sign-in screen. Body styling is left to
 * admin.css so the two do not fight over background and font — an inline
 * style here would win over the stylesheet and the admin screens would
 * render with the wrong typeface.
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
