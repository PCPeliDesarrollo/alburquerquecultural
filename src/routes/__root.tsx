import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import logo from "@/assets/logo-alburquerque.png.asset.json";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o ha sido movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Esta página no cargó correctamente</h1>
        <p className="mt-2 text-sm text-muted-foreground">Puedes reintentar o volver al inicio.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >Reintentar</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">Inicio</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ayuntamiento de Alburquerque — Entradas y Eventos" },
      { name: "description", content: "Compra entradas para el Festival Medieval y otros eventos culturales de Alburquerque (Badajoz)." },
      { name: "author", content: "Ayuntamiento de Alburquerque" },
      { name: "theme-color", content: "#6b1f1a" },
      { property: "og:title", content: "Ayuntamiento de Alburquerque — Entradas y Eventos" },
      { property: "og:description", content: "Festival Medieval, teatro, cultura y más." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "icon", href: logo.url, type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader() {
  const [session, setSession] = useState<{ email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session?.user ? { email: data.session.user.email } : null);
      if (data.session?.user) {
        supabase.from("user_roles").select("role").eq("user_id", data.session.user.id).then(({ data: r }) => {
          setIsAdmin(!!r?.some((x) => x.role === "admin"));
        });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s?.user ? { email: s.user.email } : null);
      if (!s?.user) setIsAdmin(false);
      else {
        supabase.from("user_roles").select("role").eq("user_id", s.user.id).then(({ data: r }) => {
          setIsAdmin(!!r?.some((x) => x.role === "admin"));
        });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src={logo.url} alt="Escudo de Alburquerque" className="h-11 w-11 shrink-0 object-contain" />
          <div className="min-w-0 leading-tight">
            <div className="font-display text-sm font-semibold uppercase tracking-widest text-primary">Alburquerque</div>
            <div className="truncate text-xs text-muted-foreground">Ayuntamiento · Cultura y Eventos</div>
          </div>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link to="/" className="rounded-md px-3 py-2 hover:bg-accent" activeOptions={{ exact: true }} activeProps={{ className: "text-primary font-semibold" }}>Eventos</Link>
          {session && (
            <Link to="/mis-entradas" className="rounded-md px-3 py-2 hover:bg-accent" activeProps={{ className: "text-primary font-semibold" }}>Mis entradas</Link>
          )}
          {isAdmin && (
            <Link to="/admin" className="rounded-md px-3 py-2 hover:bg-accent" activeProps={{ className: "text-primary font-semibold" }}>Panel</Link>
          )}
          {session ? (
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
              className="ml-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
            >Salir</button>
          ) : (
            <Link to="/auth" className="ml-2 rounded-md bg-primary px-4 py-2 text-primary-foreground shadow-elegant hover:opacity-90">
              Acceder
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt="" className="h-8 w-8 object-contain" />
          <span>© {new Date().getFullYear()} Ayuntamiento de Alburquerque · Badajoz</span>
        </div>
        <div>Plaza de España · 06510 Alburquerque</div>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1"><Outlet /></main>
        <SiteFooter />
      </div>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
