import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
        <h2 className="text-xl font-bold">Não foi possível carregar esta tela</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
        <Button className="mt-6" onClick={() => router.invalidate()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

export function RouteNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h2 className="text-xl font-bold">Não encontrado</h2>
        <a href="/" className="mt-4 inline-block text-primary underline">Voltar ao menu</a>
      </div>
    </div>
  );
}
