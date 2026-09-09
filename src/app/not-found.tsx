import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-12">
      <h1 className="text-2xl">Este caminho não existe.</h1>
      <Link href="/dashboard" className="mt-6 inline-block text-primary">
        Voltar ao LifeOS →
      </Link>
    </main>
  );
}
