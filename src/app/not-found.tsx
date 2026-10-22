import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-10">
      <h1 className="mb-4 text-2xl font-semibold">Page not found</h1>
      <Link className="text-blue-700 underline" href="/">
        Return to workspace
      </Link>
    </main>
  );
}
