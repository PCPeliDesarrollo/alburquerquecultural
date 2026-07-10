import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-alburquerque.png.asset.json";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/" });
    });
  }, [navigate, redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nombre, apellidos },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Ya puedes acceder.");
        // Auto sign-in (email confirm off by default)
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (!e2) navigate({ to: redirect ?? "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenido");
        navigate({ to: redirect ?? "/" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Ha ocurrido un error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-160px)] max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2">
      <div className="hidden lg:block">
        <img src={logo.url} alt="" className="h-32" />
        <h1 className="mt-6 font-display text-4xl text-primary">Bienvenido a la villa.</h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Accede para comprar entradas del Festival Medieval y otros eventos culturales del
          Ayuntamiento de Alburquerque.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="mb-6 flex gap-2 rounded-lg bg-muted p-1">
          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium ${mode === "login" ? "bg-background shadow" : ""}`}
            onClick={() => setMode("login")}
          >Acceder</button>
          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium ${mode === "signup" ? "bg-background shadow" : ""}`}
            onClick={() => setMode("signup")}
          >Crear cuenta</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Nombre</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
                  className="h-11 w-full rounded-md border border-input bg-background px-3" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Apellidos</label>
                <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} required
                  className="h-11 w-full rounded-md border border-input bg-background px-3" />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="h-11 w-full rounded-md border border-input bg-background px-3" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="h-11 w-full rounded-md border border-input bg-background px-3" />
          </div>
          <button type="submit" disabled={loading}
            className="mt-2 h-11 w-full rounded-md bg-primary font-semibold text-primary-foreground shadow-elegant transition hover:opacity-90 disabled:opacity-60">
            {loading ? "Procesando…" : mode === "login" ? "Acceder" : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Al continuar aceptas el uso responsable del servicio municipal.
        </p>
      </div>
    </div>
  );
}
