import Link from "next/link";
import { Package } from "lucide-react";
import { SignOut } from "./workflows";
import { requirePageRole } from "@/server/page-auth";
export async function AppShell({
  children,
  title,
  eyebrow = "Parcel delivery",
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
}) {
  await requirePageRole("ADMIN");
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="border-r border-slate-200 bg-white p-6">
        <Link
          href="/admin/parcels"
          className="flex items-center gap-3 text-xl font-bold mb-8"
        >
          <Package />
          ParcelFlow
        </Link>
        <nav
          aria-label="Admin navigation"
          className="flex flex-wrap gap-4 lg:flex-col"
        >
          {[
            ["Riders", "/admin/riders"],
            ["Parcels", "/admin/parcels"],
            ["Assignments", "/admin/assignments"],
          ].map(([name, url]) => (
            <Link key={url} href={url}>
              {name}
            </Link>
          ))}
        </nav>
        <div className="mt-8">
          <SignOut />
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-7xl p-5 md:p-10">
        <p className="text-xs uppercase tracking-widest text-blue-700 mb-2">
          {eyebrow}
        </p>
        <h1 className="mb-7 text-3xl font-semibold">{title}</h1>
        {children}
      </main>
    </div>
  );
}
