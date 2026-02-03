import Link from "next/link";

export default function ProgramPage() {
  return (
    <main>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📅 Программа</h1>
          <p className="page-subtitle">Управление тренировочным циклом</p>
        </div>

        <Link className="btn btn-secondary" href="/">
          ← На главную
        </Link>
      </div>

      {/* Заглушка */}
      <div className="card">
        <div className="card-body text-center py-16">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="text-xl font-semibold mb-2">В разработке</h2>
          <p className="text-[var(--text-secondary)] max-w-md mx-auto">
            Здесь будет управление циклом и фазами, календарь нагрузок,
            дополнительные активности (соревнования, встречи).
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <div className="card bg-[var(--bg-secondary)] px-6 py-4 text-center">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-sm text-[var(--text-muted)]">Фазы цикла</div>
            </div>
            <div className="card bg-[var(--bg-secondary)] px-6 py-4 text-center">
              <div className="text-2xl mb-1">📆</div>
              <div className="text-sm text-[var(--text-muted)]">Календарь</div>
            </div>
            <div className="card bg-[var(--bg-secondary)] px-6 py-4 text-center">
              <div className="text-2xl mb-1">🏆</div>
              <div className="text-sm text-[var(--text-muted)]">События</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
