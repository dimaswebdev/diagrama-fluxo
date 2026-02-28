'use client';

export function FloatingHeader() {
  return (
    <header className="fixed top-4 left-4 z-10">
      <div className="px-4 py-2 rounded-2xl bg-card/70 backdrop-blur-xl border border-white/20 shadow-lg">
        <h1 className="text-lg font-semibold text-foreground">Cronograma Evidência</h1>
      </div>
    </header>
  );
}
