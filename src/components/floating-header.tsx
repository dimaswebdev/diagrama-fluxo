'use client';

export function FloatingHeader() {
  return (
    <header className="fixed top-4 left-4 z-10">
      <div className="px-4 py-2 rounded-lg bg-card/60 backdrop-blur-sm border border-border/50 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Cronograma Evidência</h1>
      </div>
    </header>
  );
}
