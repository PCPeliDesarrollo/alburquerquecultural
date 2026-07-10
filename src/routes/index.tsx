import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-alburquerque.png.asset.json";

type Evento = {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  fecha: string;
  hora: string;
  lugar: string;
  imagen_url: string | null;
  precio: number;
  aforo_maximo: number;
  entradas_vendidas: number;
  recurrente_diario: boolean;
};

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [filtro, setFiltro] = useState<string>("Todos");

  useEffect(() => {
    supabase
      .from("eventos")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("fecha", { ascending: true })
      .then(({ data }) => setEventos((data as Evento[]) ?? []));
  }, []);


  const categorias = useMemo(() => {
    const set = new Set<string>(["Todos"]);
    eventos?.forEach((e) => set.add(e.categoria));
    return Array.from(set);
  }, [eventos]);

  const visibles = eventos?.filter((e) => filtro === "Todos" || e.categoria === filtro) ?? [];

  return (
    <div>
      {/* Catálogo — primero, pensado para móvil */}
      <section id="catalogo" className="mx-auto max-w-7xl px-3 pb-10 pt-5 sm:px-4 sm:pt-8">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-2xl uppercase tracking-widest text-primary sm:text-3xl">Entradas</h2>
          </div>
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setFiltro(c)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs transition sm:text-sm ${
                  filtro === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >{c}</button>
            ))}
          </div>
        </div>

        {eventos === null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {visibles.map((e) => <EventoCard key={e.id} evento={e} />)}
          </div>
        )}
      </section>

      {/* Hero — ahora al final, como presentación */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:py-16 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-widest sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)]" />
              Alburquerque Cultural · Badajoz
            </div>
            <h1 className="mt-4 font-display text-3xl leading-tight sm:text-5xl md:text-6xl">
              Vive Alburquerque.<br />
              <span className="text-[color:var(--gold)]">Toda su cultura, en una entrada.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm text-white/80 sm:text-base">
              Compra tus entradas para el teatro en la Casa de la Cultura, la piscina municipal,
              el Festival Medieval, conciertos, actividades infantiles y deportivas del Ayuntamiento.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/mis-entradas" className="rounded-md border border-white/30 bg-white/5 px-5 py-3 text-sm font-medium hover:bg-white/10">
                Mis entradas
              </Link>
            </div>
          </div>
          <div className="hidden justify-center md:flex">
            <img src={logo.url} alt="Escudo del Ayuntamiento" className="w-56 drop-shadow-2xl" />
          </div>
        </div>
      </section>
    </div>
  );
}


function EventoCard({ evento }: { evento: Evento }) {
  const disponibles = evento.aforo_maximo - evento.entradas_vendidas;
  const agotado = disponibles <= 0;
  return (
    <Link
      to="/eventos/$id"
      params={{ id: evento.id }}
      className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-elegant"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {evento.imagen_url ? (
          <img src={evento.imagen_url} alt={evento.titulo} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
            <img src={logo.url} alt="" className="h-12 opacity-70" />
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-[color:var(--gold)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--gold-foreground)]">
          {evento.categoria}
        </span>
        {agotado && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
            Agotado
          </span>
        )}
      </div>
      <div className="p-2.5 sm:p-3">
        <h3 className="line-clamp-2 font-display text-sm leading-tight text-foreground sm:text-base">{evento.titulo}</h3>
        <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">
          {evento.recurrente_diario
            ? <><span className="font-medium text-[color:var(--gold)]">Todos los días</span> · {evento.hora.slice(0, 5)}</>
            : <>{formatDateShort(evento.fecha)} · {evento.hora.slice(0, 5)}</>}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-primary sm:text-base">
            {evento.precio > 0 ? `${Number(evento.precio).toFixed(2)} €` : "Gratis"}
          </div>
          <div className="truncate text-[10px] text-muted-foreground sm:text-xs">
            {evento.recurrente_diario ? "Diaria" : `${disponibles} plazas`}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function formatDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", {
    day: "numeric", month: "short",
  });
}


function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <img src={logo.url} alt="" className="mx-auto h-16 opacity-80" />
      <h3 className="mt-4 font-display text-xl">Aún no hay eventos publicados</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        El personal del Ayuntamiento puede crear eventos desde el Panel de administración.
      </p>
    </div>
  );
}

export function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
