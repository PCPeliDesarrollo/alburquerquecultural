
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS recurrente_diario boolean NOT NULL DEFAULT false;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS fecha_evento date;
