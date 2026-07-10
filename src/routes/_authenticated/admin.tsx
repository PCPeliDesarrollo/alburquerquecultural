import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "../index";

type Evento = {
  id: string; titulo: string; descripcion: string; categoria: string;
  fecha: string; hora: string; lugar: string; imagen_url: string | null;
  precio: number; aforo_maximo: number; entradas_vendidas: number; activo: boolean;
  recurrente_diario: boolean; orden: number;
};


type Asistente = { compra_id: string; cantidad: number; total: number; codigo_qr: string; email: string; nombre: string | null; apellidos: string | null; fecha_compra: string };

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
  precio: 0, aforo_maximo: 100, activo: true, recurrente_diario: false, orden: 100,
};


function AdminPanel() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [editing, setEditing] = useState<Partial<Evento> | null>(null);
  const [asistentesDe, setAsistentesDe] = useState<string | null>(null);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [tab, setTab] = useState<string>("Todos");


  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return setIsAdmin(false);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userRes.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    })();
  }, []);

  async function refresh() {
    const { data } = await supabase.from("eventos").select("*").order("orden", { ascending: true }).order("fecha", { ascending: true });
    setEventos((data as Evento[]) ?? []);
  }

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  async function guardar() {
    if (!editing) return;
    const esDiario = !!editing.recurrente_diario;
    if (!editing.titulo || !editing.descripcion || !editing.hora || !editing.lugar || !editing.categoria || (!esDiario && !editing.fecha)) {
      toast.error("Rellena todos los campos obligatorios");
      return;
    }
    const hoy = new Date();
    const hoyISO = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const payload = {
      titulo: editing.titulo,
      descripcion: editing.descripcion,
      categoria: editing.categoria,
      fecha: esDiario ? hoyISO : editing.fecha!,
      hora: editing.hora,
      lugar: editing.lugar,
      imagen_url: editing.imagen_url || null,
      precio: Number(editing.precio) || 0,
      aforo_maximo: Number(editing.aforo_maximo) || 0,
      activo: editing.activo ?? true,
      recurrente_diario: esDiario,
      orden: Number.isFinite(Number(editing.orden)) ? Number(editing.orden) : 100,
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
      .select("id, cantidad_entradas, total_pagado, codigo_qr, fecha_compra, profiles(email, nombre, apellidos)")
      .eq("evento_id", evento.id)
      .order("fecha_compra", { ascending: false });
    setAsistentes(((data as any[]) ?? []).map((r) => ({
      compra_id: r.id, cantidad: r.cantidad_entradas, total: r.total_pagado,
      codigo_qr: r.codigo_qr, fecha_compra: r.fecha_compra,
      email: r.profiles?.email ?? "—", nombre: r.profiles?.nombre ?? null,
      apellidos: r.profiles?.apellidos ?? null,
    })));
  }

  function exportarCsv(evento: Evento) {
    const rows = [["Nombre", "Apellidos", "Email", "Entradas", "Total (€)", "Localizador", "Fecha compra"]];
    asistentes.forEach((a) => rows.push([a.nombre ?? "", a.apellidos ?? "", a.email, String(a.cantidad), String(a.total), a.codigo_qr, new Date(a.fecha_compra).toISOString()]));
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

  // Categorías presentes en los eventos (más "Todos") — se muestran como pestañas
  const tabs = ["Todos", ...CATEGORIAS.filter((c) => eventos.some((e) => e.categoria === c))];
  const eventosTab = tab === "Todos" ? eventos : eventos.filter((e) => e.categoria === tab);


  // Totales por cada tipo de entrada para las tarjetas compactas
  const totalesPorCategoria = CATEGORIAS.filter((c) => eventos.some((e) => e.categoria === c)).map((c) => {
    const evs = eventos.filter((e) => e.categoria === c);
    return {
      categoria: c,
      activos: evs.filter((e) => e.activo).length,
      vendidas: evs.reduce((s, e) => s + e.entradas_vendidas, 0),
      aforo: evs.reduce((s, e) => s + e.aforo_maximo, 0),
      recaudado: evs.reduce((s, e) => s + e.entradas_vendidas * Number(e.precio), 0),
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-primary">Panel de administración</h1>
          <p className="text-xs text-muted-foreground">Gestiona el catálogo cultural del Ayuntamiento.</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY, categoria: tab !== "Todos" ? tab : EMPTY.categoria })}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-elegant hover:opacity-90"
        >+ Nuevo{tab !== "Todos" ? ` en ${tab}` : " evento"}</button>
      </div>

      {/* Tarjetas compactas por tipo de entrada */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {totalesPorCategoria.map((t) => (
          <div
            key={t.categoria}
            className={`rounded-lg border p-2.5 text-xs ${tab === t.categoria ? "border-primary bg-primary/5" : "border-border bg-card"}`}
          >
            <div className="mb-2 font-display text-sm font-semibold text-primary">{t.categoria}</div>
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Eventos activos</span>
                <span className="font-medium text-foreground">{t.activos}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Entradas vendidas</span>
                <span className="font-medium text-foreground">{t.vendidas} / {t.aforo}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Recaudación</span>
                <span className="font-medium text-foreground">{t.recaudado.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pestañas por tipo de entrada */}
      <div className="mt-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((c) => {
          const count = c === "Todos" ? eventos.length : eventos.filter((e) => e.categoria === c).length;
          const active = tab === c;
          return (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent"
              }`}
            >{c} <span className={`ml-1 text-[10px] ${active ? "opacity-80" : "text-muted-foreground"}`}>({count})</span></button>
          );
        })}
      </div>


      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="p-3">Evento</th><th className="p-3">Fecha</th>
              <th className="p-3">Vendidas</th><th className="p-3">Recaudado</th>
              <th className="p-3">Estado</th><th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {eventosTab.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3">
                  <div className="font-medium">{e.titulo}</div>
                  <div className="text-xs text-muted-foreground">{e.categoria} · {e.lugar}</div>
                </td>
                <td className="p-3">{e.recurrente_diario ? <span className="text-[color:var(--gold)] font-medium">Diario</span> : formatDate(e.fecha)}<div className="text-xs text-muted-foreground">{e.hora.slice(0,5)}</div></td>
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
            {eventosTab.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                {tab === "Todos" ? "Aún no hay eventos. Crea el primero." : `Aún no hay eventos en "${tab}". Crea el primero.`}
              </td></tr>
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
            <Field label={editing.recurrente_diario ? "Fecha (se asigna automáticamente cada día)" : "Fecha"}>
              <input type="date" className="input" disabled={!!editing.recurrente_diario}
                value={editing.recurrente_diario ? "" : (editing.fecha ?? "")}
                onChange={(e) => setEditing({ ...editing, fecha: e.target.value })} />
            </Field>
            <Field label="Hora"><input type="time" className="input" value={editing.hora ?? ""} onChange={(e) => setEditing({ ...editing, hora: e.target.value })} /></Field>
            <Field label="Lugar"><input className="input" value={editing.lugar ?? ""} onChange={(e) => setEditing({ ...editing, lugar: e.target.value })} /></Field>
            <Field label="Imagen del evento" full>
              <ImagenUploader
                value={editing.imagen_url ?? ""}
                onChange={(url) => setEditing({ ...editing, imagen_url: url })}
              />
            </Field>
            <Field label="Precio (€)"><input type="number" step="0.01" className="input" value={editing.precio ?? 0} onChange={(e) => setEditing({ ...editing, precio: Number(e.target.value) })} /></Field>
            <Field label="Aforo máximo"><input type="number" className="input" value={editing.aforo_maximo ?? 0} onChange={(e) => setEditing({ ...editing, aforo_maximo: Number(e.target.value) })} /></Field>
            <Field label="Orden (menor = aparece antes)" full>
              <input type="number" className="input" value={editing.orden ?? 100} onChange={(e) => setEditing({ ...editing, orden: Number(e.target.value) })} />
            </Field>

            <Field label="Descripción" full>
              <textarea rows={5} className="input" value={editing.descripcion ?? ""} onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })} />
            </Field>
            <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm sm:col-span-2">
              <input type="checkbox" className="mt-0.5" checked={!!editing.recurrente_diario}
                onChange={(e) => setEditing({ ...editing, recurrente_diario: e.target.checked })} />
              <span>
                <span className="font-medium">Entrada diaria</span>
                <span className="block text-xs text-muted-foreground">
                  Marca esta opción para entradas válidas solo el día en que se compran (p. ej. piscina municipal). La fecha se ajusta automáticamente cada día.
                </span>
              </span>
            </label>
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
                <th className="p-2 text-left">Nombre y apellidos</th><th className="p-2 text-left">Email</th>
                <th className="p-2">Entradas</th><th className="p-2">Total</th>
                <th className="p-2 text-left">Localizador</th><th className="p-2">Fecha</th>
              </tr></thead>
              <tbody>
                {asistentes.map((a) => (
                  <tr key={a.compra_id} className="border-t border-border">
                    <td className="p-2">{[a.nombre, a.apellidos].filter(Boolean).join(" ") || "—"}</td>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-4xl" : "max-w-2xl"} max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-elegant`}
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

function ImagenUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [subiendo, setSubiendo] = useState(false);

  async function subir(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen (JPG, PNG, WEBP...)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar los 5 MB");
      return;
    }
    setSubiendo(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("eventos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    setSubiendo(false);
    if (error) {
      toast.error(`No se pudo subir la imagen: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from("eventos").getPublicUrl(path);
    onChange(data.publicUrl);
    toast.success("Imagen subida correctamente");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent ${subiendo ? "pointer-events-none opacity-60" : ""}`}>
          {subiendo ? "Subiendo…" : "📷 Subir desde el ordenador"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subir(f);
              e.target.value = "";
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-destructive hover:underline"
          >Quitar imagen</button>
        )}
      </div>
      <input
        className="input"
        placeholder="…o pega una URL de imagen"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <div className="overflow-hidden rounded-md border border-border bg-muted">
          <img src={value} alt="Vista previa" className="max-h-48 w-full object-cover" />
        </div>
      )}
    </div>
  );
}
