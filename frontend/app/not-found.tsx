import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center dark:bg-gray-950">
      <div className="flex flex-col items-center gap-6">
        <span className="text-8xl" role="img" aria-label="Page introuvable">🔍</span>
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">404</h1>
          <p className="mt-2 text-xl font-semibold text-gray-700 dark:text-gray-300">Page introuvable</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Désolé, la page que vous recherchez n&apos;existe pas ou a été déplacée.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
