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
      {/* Hero */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 md:grid-cols-[1.2fr_1fr]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)]" />
              Alburquerque Cultural · Badajoz
            </div>
            <h1 className="mt-5 font-display text-4xl leading-tight sm:text-6xl">
              Vive Alburquerque.<br />
              <span className="text-[color:var(--gold)]">Toda su cultura, en una entrada.</span>
            </h1>
            <p className="mt-5 max-w-xl text-white/80">
              Compra tus entradas para el teatro en la Casa de la Cultura, la piscina municipal,
              el Festival Medieval, conciertos, actividades infantiles y deportivas del Ayuntamiento.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#catalogo" className="rounded-md bg-[color:var(--gold)] px-5 py-3 font-semibold text-[color:var(--gold-foreground)] shadow-gold transition hover:brightness-105">
                Ver eventos
              </a>
              <Link to="/mis-entradas" className="rounded-md border border-white/30 bg-white/5 px-5 py-3 font-medium hover:bg-white/10">
                Mis entradas
              </Link>
            </div>
          </div>
          <div className="hidden justify-center md:flex">
            <img src={logo.url} alt="Escudo del Ayuntamiento" className="w-64 drop-shadow-2xl" />
          </div>
        </div>
      </section>

      {/* Catálogo */}
      <section id="catalogo" className="mx-auto max-w-7xl px-4 py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-primary">Próximas actividades</h2>
            <p className="text-sm text-muted-foreground">Teatro, piscina, festivales y patrimonio en el corazón de la villa.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setFiltro(c)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  filtro === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >{c}</button>
            ))}
          </div>
        </div>

        {eventos === null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((e) => <EventoCard key={e.id} evento={e} />)}
          </div>
        )}
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
      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-elegant"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {evento.imagen_url ? (
          <img src={evento.imagen_url} alt={evento.titulo} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
            <img src={logo.url} alt="" className="h-20 opacity-70" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-[color:var(--gold)] px-3 py-1 text-xs font-semibold text-[color:var(--gold-foreground)]">
          {evento.categoria}
        </span>
        {agotado && (
          <span className="absolute right-3 top-3 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground">
            Agotado
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl leading-tight text-foreground">{evento.titulo}</h3>
        <div className="mt-2 text-sm text-muted-foreground">
          {evento.recurrente_diario
            ? <><span className="font-medium text-[color:var(--gold)]">Todos los días</span> · {evento.hora.slice(0, 5)} · {evento.lugar}</>
            : <>{formatDate(evento.fecha)} · {evento.hora.slice(0, 5)} · {evento.lugar}</>}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-primary">
            {evento.precio > 0 ? `${Number(evento.precio).toFixed(2)} €` : "Gratis"}
          </div>
          <div className="text-xs text-muted-foreground">
            {evento.recurrente_diario ? "Entrada diaria" : `${evento.aforo_maximo - evento.entradas_vendidas} plazas`}
          </div>
        </div>
      </div>
    </Link>
  );
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
