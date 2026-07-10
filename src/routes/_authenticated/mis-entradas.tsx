import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "../index";
import logo from "@/assets/logo-alburquerque.png.asset.json";

type Compra = {
  id: string;
  cantidad_entradas: number;
  total_pagado: number;
  codigo_qr: string;
  fecha_compra: string;
  fecha_evento: string | null;
  eventos: {
    titulo: string; fecha: string; hora: string; lugar: string; categoria: string;
    recurrente_diario: boolean;
  } | null;
};

export const Route = createFileRoute("/_authenticated/mis-entradas")({
  component: MisEntradas,
});

function MisEntradas() {
  const [compras, setCompras] = useState<Compra[] | null>(null);

  useEffect(() => {
    supabase
      .from("compras")
      .select("id, cantidad_entradas, total_pagado, codigo_qr, fecha_compra, fecha_evento, eventos(titulo, fecha, hora, lugar, categoria, recurrente_diario)")
      .order("fecha_compra", { ascending: false })
      .then(({ data }) => setCompras((data as any) ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-primary">Mis entradas</h1>
        <p className="text-sm text-muted-foreground">Muestra el localizador en la entrada del evento.</p>
      </div>

      {compras === null ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : compras.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <img src={logo.url} alt="" className="mx-auto h-16 opacity-80" />
          <h3 className="mt-4 font-display text-xl">Todavía no tienes entradas</h3>
          <Link to="/" className="mt-4 inline-block text-primary underline">Explorar eventos</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {compras.map((c) => <TicketRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

function TicketRow({ c }: { c: Compra }) {
  return (
    <div className="grid gap-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:grid-cols-[1fr_auto]">
      <div className="p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[color:var(--gold)]">
          {c.eventos?.categoria ?? "Evento"}
        </div>
        <h3 className="mt-1 font-display text-xl text-primary">{c.eventos?.titulo ?? "Evento"}</h3>
        <div className="mt-1 text-sm text-muted-foreground">
          {c.eventos && `${formatDate(c.fecha_evento ?? c.eventos.fecha)} · ${c.eventos.hora.slice(0,5)} · ${c.eventos.lugar}`}
        </div>
        {c.eventos?.recurrente_diario && (
          <div className="mt-1 inline-block rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
            Entrada válida solo el {formatDate(c.fecha_evento ?? c.eventos.fecha)}
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div><div className="text-muted-foreground">Entradas</div><div className="font-semibold">{c.cantidad_entradas}</div></div>
          <div><div className="text-muted-foreground">Total</div><div className="font-semibold">{Number(c.total_pagado).toFixed(2)} €</div></div>
          <div><div className="text-muted-foreground">Compra</div><div className="font-semibold">{new Date(c.fecha_compra).toLocaleDateString("es-ES")}</div></div>
        </div>
      </div>
      <div
        className="flex flex-col items-center justify-center gap-2 border-t border-dashed border-border p-6 sm:border-l sm:border-t-0"
        style={{ background: "var(--gradient-hero)", color: "white" }}
      >
        <QrPlaceholder text={c.codigo_qr} />
        <div className="mt-2 font-mono text-xs tracking-wider">{c.codigo_qr}</div>
        <div className="text-[10px] uppercase tracking-widest text-white/60">Localizador</div>
      </div>
    </div>
  );
}

function QrPlaceholder({ text }: { text: string }) {
  // "QR" ficticio determinista basado en el hash del código
  const cells = 9;
  const grid: boolean[] = [];
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  for (let i = 0; i < cells * cells; i++) { h = (h * 1664525 + 1013904223) >>> 0; grid.push((h & 1) === 1); }
  return (
    <div className="grid gap-[2px] rounded-md bg-white p-2" style={{ gridTemplateColumns: `repeat(${cells}, 10px)` }}>
      {grid.map((on, i) => <div key={i} className="h-[10px] w-[10px]" style={{ background: on ? "#111" : "transparent" }} />)}
    </div>
  );
}
