import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Share2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "../index";
import logo from "@/assets/logo-alburquerque.png.asset.json";

type Entrada = {
  id: string;
  codigo_qr: string;
  usada: boolean;
  fecha_uso: string | null;
  compra_id: string;
  fecha_evento: string | null;
  fecha_compra: string;
  precio_unitario: number;
  evento: {
    titulo: string; fecha: string; hora: string; lugar: string; categoria: string;
    recurrente_diario: boolean;
  } | null;
};

export const Route = createFileRoute("/_authenticated/mis-entradas")({
  component: MisEntradas,
});

function MisEntradas() {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [profile, setProfile] = useState<{ id: string; nombre: string | null; apellidos: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (uid) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, nombre, apellidos")
          .eq("id", uid)
          .maybeSingle();
        setProfile(p ?? { id: uid, nombre: null, apellidos: null });
      }

      const { data } = await supabase
        .from("entradas")
        .select("id, codigo_qr, usada, fecha_uso, compra_id, compras(cantidad_entradas, total_pagado, fecha_evento, fecha_compra), eventos(titulo, fecha, hora, lugar, categoria, recurrente_diario)")
        .eq("user_id", uid ?? "")
        .order("created_at", { ascending: false });
      const rows: Entrada[] = ((data as any[]) ?? []).map((r) => {
        const cant = r.compras?.cantidad_entradas ?? 1;
        const total = Number(r.compras?.total_pagado ?? 0);
        return {
          id: r.id,
          codigo_qr: r.codigo_qr,
          usada: r.usada,
          fecha_uso: r.fecha_uso,
          compra_id: r.compra_id,
          fecha_evento: r.compras?.fecha_evento ?? null,
          fecha_compra: r.compras?.fecha_compra ?? new Date().toISOString(),
          precio_unitario: cant > 0 ? total / cant : total,
          evento: r.eventos,
        };
      });
      setEntradas(rows);
    })();
  }, []);

  const necesitaDatos = !!profile && (!profile.nombre?.trim() || !profile.apellidos?.trim());

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-primary">Mis entradas</h1>
        <p className="text-sm text-muted-foreground">
          Cada entrada es individual y de un solo uso. Muestra el localizador en la entrada del evento.
        </p>
      </div>

      {necesitaDatos && profile && (
        <ProfileCompletar profile={profile} onSaved={(p) => setProfile({ ...profile, ...p })} />
      )}



      {entradas === null ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : entradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <img src={logo.url} alt="" className="mx-auto h-16 opacity-80" />
          <h3 className="mt-4 font-display text-xl">Todavía no tienes entradas</h3>
          <Link to="/" className="mt-4 inline-block text-primary underline">Explorar eventos</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entradas.map((e, idx) => {
            const total = entradas.filter((x) => x.compra_id === e.compra_id).length;
            const num = entradas.filter((x) => x.compra_id === e.compra_id).findIndex((x) => x.id === e.id) + 1;
            return <TicketCard key={e.id} e={e} num={num} total={total} idx={idx} />;
          })}
        </div>
      )}
    </div>
  );
}

function ProfileCompletar({
  profile,
  onSaved,
}: {
  profile: { id: string; nombre: string | null; apellidos: string | null };
  onSaved: (p: { nombre: string; apellidos: string }) => void;
}) {
  const [nombre, setNombre] = useState(profile.nombre ?? "");
  const [apellidos, setApellidos] = useState(profile.apellidos ?? "");
  const [saving, setSaving] = useState(false);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nombre.trim() || !apellidos.trim()) {
      toast.error("Nombre y apellidos son obligatorios");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nombre: nombre.trim(), apellidos: apellidos.trim() })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Datos actualizados");
    onSaved({ nombre: nombre.trim(), apellidos: apellidos.trim() });
  }

  return (
    <form
      onSubmit={guardar}
      className="mb-6 rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-5"
    >
      <div className="mb-3">
        <h3 className="font-display text-lg text-primary">Completa tus datos</h3>
        <p className="text-xs text-muted-foreground">
          Necesitamos tu nombre y apellidos para que aparezcan en el listado de asistentes del evento.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          required
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          value={apellidos}
          onChange={(e) => setApellidos(e.target.value)}
          placeholder="Apellidos"
          required
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function TicketCard({ e, num, total }: { e: Entrada; num: number; total: number; idx: number }) {
  const titulo = e.evento?.titulo ?? "Evento";
  const fechaTxt = e.evento ? `${formatDate(e.fecha_evento ?? e.evento.fecha)} · ${e.evento.hora.slice(0, 5)}` : "";
  const lugar = e.evento?.lugar ?? "";

  const shareText =
`🎟️ Entrada — ${titulo}
📅 ${fechaTxt}
📍 ${lugar}
Localizador: ${e.codigo_qr}
Entrada ${num} de ${total} — VÁLIDA PARA UN SOLO USO
Alburquerque Cultural`;

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/` : "";

  function compartirWhatsapp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`;
    window.open(url, "_blank", "noopener");
  }
  function compartirEmail() {
    const subject = `Entrada: ${titulo}`;
    const body = shareText + "\n\n" + shareUrl;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  async function compartirNativo() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: titulo, text: shareText, url: shareUrl }); return; }
      catch { /* cancelado */ }
    }
    compartirWhatsapp();
  }

  return (
    <div className={`grid grid-cols-[1fr_auto] overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${e.usada ? "opacity-70" : ""}`}>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--gold)]">
            {e.evento?.categoria ?? "Evento"}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            · {num}/{total}
          </span>
          {e.usada && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Usada
            </span>
          )}
        </div>
        <h3 className="mt-1 font-display text-lg leading-tight text-primary">{titulo}</h3>
        <div className="mt-1 text-xs text-muted-foreground">{fechaTxt}</div>
        <div className="text-xs text-muted-foreground">{lugar}</div>
        {e.evento?.recurrente_diario && (
          <div className="mt-2 inline-block rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
            Válida solo el {formatDate(e.fecha_evento ?? e.evento.fecha)}
          </div>
        )}
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Un solo uso · {Number(e.precio_unitario).toFixed(2)} €
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={compartirWhatsapp}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            title="Compartir por WhatsApp"
          >
            <svg viewBox="0 0 32 32" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M19.11 17.58c-.28-.14-1.67-.82-1.93-.92-.26-.09-.45-.14-.63.14-.19.28-.72.92-.88 1.1-.16.19-.32.21-.6.07-.28-.14-1.19-.44-2.27-1.4-.84-.75-1.4-1.68-1.57-1.96-.16-.28-.02-.43.12-.57.13-.12.28-.32.42-.48.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.63-1.52-.86-2.09-.23-.55-.46-.47-.63-.48h-.54c-.19 0-.49.07-.75.35s-1 .98-1 2.39 1.02 2.77 1.16 2.96c.14.19 2 3.06 4.86 4.29.68.29 1.21.47 1.62.6.68.22 1.31.19 1.8.11.55-.08 1.67-.68 1.91-1.34.24-.66.24-1.23.17-1.34-.07-.11-.26-.19-.54-.33zM16 5.33C10.11 5.33 5.33 10.11 5.33 16c0 1.88.49 3.72 1.42 5.34l-1.5 5.49 5.63-1.48A10.6 10.6 0 0 0 16 26.67c5.89 0 10.67-4.78 10.67-10.67S21.89 5.33 16 5.33zm0 19.6c-1.65 0-3.27-.44-4.68-1.28l-.34-.2-3.34.88.89-3.25-.22-.35A8.9 8.9 0 0 1 7.11 16c0-4.9 3.99-8.89 8.89-8.89s8.89 3.99 8.89 8.89-3.99 8.93-8.89 8.93z"/>
            </svg>
            WhatsApp
          </button>
          <button
            onClick={compartirEmail}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
            title="Compartir por correo"
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
          <button
            onClick={compartirNativo}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
            title="Compartir"
          >
            <Share2 className="h-3.5 w-3.5" /> Compartir
          </button>
        </div>
      </div>
      <div
        className="flex flex-col items-center justify-center gap-1 border-l border-dashed border-border p-4"
        style={{ background: "var(--gradient-hero)", color: "white" }}
      >
        <QrPlaceholder text={e.codigo_qr} />
        <div className="mt-1 font-mono text-[10px] tracking-wider">{e.codigo_qr}</div>
        <div className="text-[9px] uppercase tracking-widest text-white/60">Localizador</div>
      </div>
    </div>
  );
}

function QrPlaceholder({ text }: { text: string }) {
  const cells = 9;
  const grid: boolean[] = [];
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  for (let i = 0; i < cells * cells; i++) { h = (h * 1664525 + 1013904223) >>> 0; grid.push((h & 1) === 1); }
  return (
    <div className="grid gap-[2px] rounded-md bg-white p-1.5" style={{ gridTemplateColumns: `repeat(${cells}, 8px)` }}>
      {grid.map((on, i) => <div key={i} className="h-[8px] w-[8px]" style={{ background: on ? "#111" : "transparent" }} />)}
    </div>
  );
}
