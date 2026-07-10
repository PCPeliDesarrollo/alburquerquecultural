import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "./index";
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

function hoyISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

export const Route = createFileRoute("/eventos/$id")({
  component: EventoDetalle,
});

function EventoDetalle() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [comprando, setComprando] = useState(false);
  const [session, setSession] = useState<{ id: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session?.user ? { id: data.session.user.id } : null));
    supabase.from("eventos").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) setNotFound(true);
      else setEvento(data as Evento);
    });
  }, [id]);

  if (notFound) return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Evento no encontrado</h1>
      <Link to="/" className="mt-6 inline-block text-primary underline">Ver todos los eventos</Link>
    </div>
  );
  if (!evento) return <div className="mx-auto max-w-6xl px-4 py-20"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;

  const disponibles = evento.aforo_maximo - evento.entradas_vendidas;
  const total = Number(evento.precio) * cantidad;

  async function comprar() {
    if (!session) {
      toast.info("Inicia sesión para comprar entradas");
      navigate({ to: "/auth", search: { redirect: `/eventos/${id}` } });
      return;
    }
    setComprando(true);
    // Pago simulado
    await new Promise((r) => setTimeout(r, 900));
    const fechaEvento = evento!.recurrente_diario ? hoyISO() : evento!.fecha;
    const { error } = await supabase.from("compras").insert({
      user_id: session.id,
      evento_id: evento!.id,
      cantidad_entradas: cantidad,
      total_pagado: total,
      fecha_evento: fechaEvento,
    });
    setComprando(false);
    if (error) {
      toast.error(error.message ?? "No se pudo procesar la compra");
      return;
    }
    toast.success("¡Compra realizada! Consulta tus entradas.");
    navigate({ to: "/mis-entradas" });
  }

  const fechaMostrada = evento.recurrente_diario ? hoyISO() : evento.fecha;

  return (
    <article className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Volver al catálogo</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="overflow-hidden rounded-2xl border border-border bg-muted">
            {evento.imagen_url ? (
              <img src={evento.imagen_url} alt={evento.titulo} className="aspect-[16/10] w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
                <img src={logo.url} alt="" className="h-24 opacity-80" />
              </div>
            )}
          </div>
          <div className="mt-6">
            <span className="rounded-full bg-[color:var(--gold)] px-3 py-1 text-xs font-semibold text-[color:var(--gold-foreground)]">{evento.categoria}</span>
            {evento.recurrente_diario && (
              <span className="ml-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">Entrada diaria</span>
            )}
            <h1 className="mt-3 font-display text-4xl text-primary">{evento.titulo}</h1>
            <div className="mt-2 text-muted-foreground">
              {evento.recurrente_diario
                ? <>Válida solo hoy · <span className="font-medium text-foreground">{formatDate(fechaMostrada)}</span> · {evento.hora.slice(0, 5)} · {evento.lugar}</>
                : <>{formatDate(evento.fecha)} · {evento.hora.slice(0, 5)} · {evento.lugar}</>}
            </div>
            <p className="mt-6 whitespace-pre-line leading-relaxed text-foreground/90">{evento.descripcion}</p>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-elegant lg:sticky lg:top-24">
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-semibold text-primary">
              {evento.precio > 0 ? `${Number(evento.precio).toFixed(2)} €` : "Gratis"}
            </div>
            <div className="text-xs text-muted-foreground">{disponibles} / {evento.aforo_maximo} plazas</div>
          </div>

          {disponibles > 0 ? (
            <>
              <label className="mt-6 block text-sm font-medium">Nº de entradas</label>
              <div className="mt-2 flex items-center gap-3">
                <button onClick={() => setCantidad(Math.max(1, cantidad - 1))} className="h-10 w-10 rounded-md border border-border hover:bg-accent">−</button>
                <input
                  type="number" min={1} max={Math.min(10, disponibles)} value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, Math.min(disponibles, Number(e.target.value) || 1)))}
                  className="h-10 w-20 rounded-md border border-input bg-background text-center"
                />
                <button onClick={() => setCantidad(Math.min(Math.min(10, disponibles), cantidad + 1))} className="h-10 w-10 rounded-md border border-border hover:bg-accent">+</button>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-xl font-semibold">{total.toFixed(2)} €</span>
              </div>

              <button
                onClick={comprar}
                disabled={comprando}
                className="mt-4 w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-elegant transition hover:opacity-90 disabled:opacity-60"
              >
                {comprando ? "Procesando pago…" : "Comprar entradas"}
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Pago simulado seguro · Pasarela demo
              </p>
            </>
          ) : (
            <div className="mt-8 rounded-md bg-destructive/10 p-4 text-center text-sm text-destructive">
              Entradas agotadas
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
