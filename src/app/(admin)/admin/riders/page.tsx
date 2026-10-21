import { AppShell, FoundationNotice } from "@/components/app-shell";
import { RiderTable } from "@/components/rider-table";
export default function RidersPage() {return <AppShell title="Rider management" eyebrow="Admin workspace"><p className="mb-6 text-slate-500">Search the five synthetic Riders included with this foundation.</p><FoundationNotice/><RiderTable/></AppShell>;}
