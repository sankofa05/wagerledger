import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "WagerLedger — Market & Sessions",
  description:
    "Observatoire marché + registre de sessions (market data & session tracking), avec une approche responsable.",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-white/80 hover:text-white transition"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <header className="sticky top-0 z-50 backdrop-blur bg-black/25 border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-wide">
            WagerLedger
<span className="text-white/60 font-normal"> — Market & Sessions</span>

            </Link>

<nav className="flex items-center gap-4">
  <NavLink href="/market">Marché</NavLink>
  <NavLink href="/tracker">Tracker</NavLink>
  <NavLink href="/sources">Sources</NavLink>
</nav>

          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>

        <footer className="max-w-6xl mx-auto px-4 pb-10 pt-6 border-t border-white/10 text-xs text-white/60">
          <div className="flex flex-col gap-2">
            <p>
              <span className="text-white/70">Disclaimer :</span> site orienté data/éducation et suivi responsable.
              Aucune promesse de gains, aucune méthode “pour battre le casino”.
            </p>
            <p>© {new Date().getFullYear()} WagerLedger — v0.1</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
