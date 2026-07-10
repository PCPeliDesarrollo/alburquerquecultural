import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "../index";

type Evento = {
  id: string; titulo: string; descripcion: string; categoria: string;
  fecha: string; hora: string; lugar: string; imagen_url: string | null;
  precio: number; aforo_maximo: number; entradas_vendidas: number; activo: boolean;
  recurrente_diario: boolean;
};

type Asistente = { compra_id: string; cantidad: number; total: number; codigo_qr: string; email: string; nombre: string | null; fecha_compra: string };

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPanel,
});

const CATEGORIAS = [
  "Teatro",
  "Casa de la Cultura",
  "Piscina Municipal",
  "Festival Medieval",
  "Música",
  "Infantil",
  "Deporte",
  "Talleres",
  "Exposiciones",
  "General",
];

const EMPTY: Partial<Evento> = {
  titulo: "", descripcion: "", categoria: "Teatro",
  fecha: "", hora: "20:00", lugar: "Casa de la Cultura", imagen_url: "",
  precio: 0, aforo_maximo: 100, activo: true, recurrente_diario: false,
};

function AdminPanel() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [editing, setEditing] = useState<Partial<Evento> | null>(null);
  const [asistentesDe, setAsistentesDe] = useState<string | null>(null);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return setIsAdmin(false);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userRes.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    })();
  }, []);

  async function refresh() {
    const { data } = await supabase.from("eventos").select("*").order("fecha", { ascending: true });
    setEventos((data as Evento[]) ?? []);
  }
  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  async function guardar() {
    if (!editing) return;
    if (!editing.titulo || !editing.descripcion || !editing.fecha || !editing.hora || !editing.lugar || !editing.categoria) {
      toast.error("Rellena todos los campos obligatorios");
      return;
    }
    const payload = {
      titulo: editing.titulo,
      descripcion: editing.descripcion,
      categoria: editing.categoria,
      fecha: editing.fecha,
      hora: editing.hora,
      lugar: editing.lugar,
      imagen_url: editing.imagen_url || null,
      precio: Number(editing.precio) || 0,
      aforo_maximo: Number(editing.aforo_maximo) || 0,
      activo: editing.activo ?? true,
    };
    const res = editing.id
      ? await supabase.from("eventos").update(payload).eq("id", editing.id)
      : await supabase.from("eventos").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Evento guardado");
    setEditing(null); refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Eliminar este evento? Esta acción es irreversible.")) return;
    const { error } = await supabase.from("eventos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Evento eliminado"); refresh();
  }

  async function verAsistentes(evento: Evento) {
    setAsistentesDe(evento.id);
    const { data } = await supabase
      .from("compras")
      .select("id, cantidad_entradas, total_pagado, codigo_qr, fecha_compra, profiles(email, nombre)")
      .eq("evento_id", evento.id)
      .order("fecha_compra", { ascending: false });
    setAsistentes(((data as any[]) ?? []).map((r) => ({
      compra_id: r.id, cantidad: r.cantidad_entradas, total: r.total_pagado,
      codigo_qr: r.codigo_qr, fecha_compra: r.fecha_compra,
      email: r.profiles?.email ?? "—", nombre: r.profiles?.nombre ?? null,
    })));
  }

  function exportarCsv(evento: Evento) {
    const rows = [["Nombre", "Email", "Entradas", "Total (€)", "Localizador", "Fecha compra"]];
    asistentes.forEach((a) => rows.push([a.nombre ?? "", a.email, String(a.cantidad), String(a.total), a.codigo_qr, new Date(a.fecha_compra).toISOString()]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `asistentes-${evento.titulo.replace(/\s+/g, "_")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (isAdmin === null) return <div className="mx-auto max-w-6xl px-4 py-16">Cargando…</div>;
  if (!isAdmin) return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-primary">Acceso restringido</h1>
      <p className="mt-3 text-muted-foreground">Este panel es solo para personal del Ayuntamiento.</p>
      <Link to="/" className="mt-6 inline-block text-primary underline">Volver al inicio</Link>
    </div>
  );

  const totales = eventos.reduce(
    (acc, e) => ({
      vendidas: acc.vendidas + e.entradas_vendidas,
      recaudado: acc.recaudado + e.entradas_vendidas * Number(e.precio),
      aforo: acc.aforo + e.aforo_maximo,
    }),
    { vendidas: 0, recaudado: 0, aforo: 0 }
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-primary">Panel de administración</h1>
          <p className="text-sm text-muted-foreground">Gestiona el catálogo cultural del Ayuntamiento.</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground shadow-elegant hover:opacity-90"
        >+ Nuevo evento</button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Eventos activos" value={eventos.filter((e) => e.activo).length.toString()} />
        <Stat label="Entradas vendidas" value={`${totales.vendidas} / ${totales.aforo}`} />
        <Stat label="Recaudación total" value={`${totales.recaudado.toFixed(2)} €`} accent />
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="p-3">Evento</th><th className="p-3">Fecha</th>
              <th className="p-3">Vendidas</th><th className="p-3">Recaudado</th>
              <th className="p-3">Estado</th><th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3">
                  <div className="font-medium">{e.titulo}</div>
                  <div className="text-xs text-muted-foreground">{e.categoria} · {e.lugar}</div>
                </td>
                <td className="p-3">{formatDate(e.fecha)}<div className="text-xs text-muted-foreground">{e.hora.slice(0,5)}</div></td>
                <td className="p-3">{e.entradas_vendidas} / {e.aforo_maximo}</td>
                <td className="p-3">{(e.entradas_vendidas * Number(e.precio)).toFixed(2)} €</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${e.activo ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                    {e.activo ? "Activo" : "Oculto"}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => verAsistentes(e)} className="mr-2 text-xs text-primary hover:underline">Asistentes</button>
                  <button onClick={() => setEditing(e)} className="mr-2 text-xs text-primary hover:underline">Editar</button>
                  <button onClick={() => borrar(e.id)} className="text-xs text-destructive hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {eventos.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aún no hay eventos. Crea el primero.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Editar evento" : "Nuevo evento"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título"><input className="input" value={editing.titulo ?? ""} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} /></Field>
            <Field label="Categoría">
              <select className="input" value={editing.categoria ?? ""} onChange={(e) => setEditing({ ...editing, categoria: e.target.value })}>
                {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Fecha"><input type="date" className="input" value={editing.fecha ?? ""} onChange={(e) => setEditing({ ...editing, fecha: e.target.value })} /></Field>
            <Field label="Hora"><input type="time" className="input" value={editing.hora ?? ""} onChange={(e) => setEditing({ ...editing, hora: e.target.value })} /></Field>
            <Field label="Lugar"><input className="input" value={editing.lugar ?? ""} onChange={(e) => setEditing({ ...editing, lugar: e.target.value })} /></Field>
            <Field label="Imagen (URL)"><input className="input" value={editing.imagen_url ?? ""} onChange={(e) => setEditing({ ...editing, imagen_url: e.target.value })} /></Field>
            <Field label="Precio (€)"><input type="number" step="0.01" className="input" value={editing.precio ?? 0} onChange={(e) => setEditing({ ...editing, precio: Number(e.target.value) })} /></Field>
            <Field label="Aforo máximo"><input type="number" className="input" value={editing.aforo_maximo ?? 0} onChange={(e) => setEditing({ ...editing, aforo_maximo: Number(e.target.value) })} /></Field>
            <Field label="Descripción" full>
              <textarea rows={5} className="input" value={editing.descripcion ?? ""} onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={editing.activo ?? true} onChange={(e) => setEditing({ ...editing, activo: e.target.checked })} />
              Evento visible al público
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancelar</button>
            <button onClick={guardar} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:opacity-90">Guardar</button>
          </div>
        </Modal>
      )}

      {asistentesDe && (
        <Modal onClose={() => setAsistentesDe(null)} title="Asistentes al evento" wide>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => exportarCsv(eventos.find((e) => e.id === asistentesDe)!)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >Descargar CSV</button>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted"><tr>
                <th className="p-2 text-left">Nombre</th><th className="p-2 text-left">Email</th>
                <th className="p-2">Entradas</th><th className="p-2">Total</th>
                <th className="p-2 text-left">Localizador</th><th className="p-2">Fecha</th>
              </tr></thead>
              <tbody>
                {asistentes.map((a) => (
                  <tr key={a.compra_id} className="border-t border-border">
                    <td className="p-2">{a.nombre ?? "—"}</td>
                    <td className="p-2">{a.email}</td>
                    <td className="p-2 text-center">{a.cantidad}</td>
                    <td className="p-2 text-center">{Number(a.total).toFixed(2)} €</td>
                    <td className="p-2 font-mono text-xs">{a.codigo_qr}</td>
                    <td className="p-2 text-center">{new Date(a.fecha_compra).toLocaleDateString("es-ES")}</td>
                  </tr>
                ))}
                {asistentes.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sin compras todavía.</td></tr>}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      <style>{`.input{height:2.5rem;width:100%;border-radius:.375rem;border:1px solid var(--input);background:var(--background);padding:0 .75rem}
        textarea.input{height:auto;padding:.5rem .75rem}`}</style>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border p-5 ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className={`text-xs uppercase tracking-widest ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</div>
      <div className="mt-1 font-display text-2xl">{value}</div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-4xl" : "max-w-2xl"} rounded-2xl border border-border bg-background p-6 shadow-elegant`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-primary">{title}</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
