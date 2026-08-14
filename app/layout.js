export const metadata = {
  title: 'YoungFreedom — Verified jobs for Bihar\'s youth',
  description: 'YoungFreedom connects Bihar\'s skilled youth with verified industrial jobs across India.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#04091A', color: '#F5F8FE',
                     fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
