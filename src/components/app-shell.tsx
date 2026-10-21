import Link from "next/link";
import { Package, ArrowUpRight } from "lucide-react";
const links = [ ["Overview", "/"], ["Customer tracking", "/track"], ["Riders", "/admin/riders"], ["Parcels", "/admin/parcels"], ["Assignments", "/admin/assignments"], ["Rider workspace", "/rider/assignments"] ];
export function AppShell({ children, title, eyebrow = "Development foundation" }: { children: React.ReactNode; title: string; eyebrow?: string }) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
    <aside className="border-r border-slate-200 bg-white p-6 lg:sticky lg:top-0 lg:h-screen">
      <Link href="/" className="mb-9 flex items-center gap-3 text-xl font-bold"><span className="rounded-xl bg-blue-600 p-2 text-white"><Package size={23}/></span>ParcelFlow</Link>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Workspace</p>
      <nav aria-label="Main navigation" className="flex flex-wrap gap-1 lg:flex-col">{links.map(([label, href]) => <Link className="rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700" key={href} href={href}>{label}</Link>)}</nav>
      <div className="mt-10 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">Code scaffold<br/>Sample screens · no operational data<br/><Link href="/login" className="mt-2 flex items-center gap-1 text-blue-700">Authentication status <ArrowUpRight size={14}/></Link></div>
    </aside>
    <div className="min-w-0"><header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 text-sm"><span className="text-slate-500">Parcel delivery management</span><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">Starter build</span></header>
    <main className="mx-auto max-w-7xl p-6 md:p-10"><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-blue-600">{eyebrow}</p><h1 className="mb-3 text-3xl font-semibold tracking-tight">{title}</h1>{children}</main></div>
  </div>;
}
export function FoundationNotice() {
  return <p className="mb-7 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">This is a code foundation. Authentication, authorized APIs, and delivery workflows remain to be implemented. Screens below use synthetic sample data only.</p>;
}
