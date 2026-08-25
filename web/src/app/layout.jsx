import './globals.css';

export const metadata = {
  title: 'Gold AI Trading Terminal — Real-Time XAU/USD',
  description: 'Autonomous Gold Trading AI Agent with Live Chart, SMC/ICT Analysis, and Exness MT5 Execution.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0B0D10] text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
