import { AppShell, FoundationNotice } from "@/components/app-shell";
export function WorkflowPlaceholder({ title, tasks }: { title: string; tasks: string[] }) {
 return <AppShell title={title}><FoundationNotice/><section className="rounded-2xl border border-slate-200 bg-white p-7"><h2 className="mb-3 text-lg font-semibold">Next implementation steps</h2><ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-slate-600">{tasks.map(t=><li key={t}>{t}</li>)}</ul><p className="mt-6 text-xs text-slate-400">See docs/IMPLEMENTATION_PLAN.md for exact fields, authorization rules and acceptance tests.</p></section></AppShell>;
}
