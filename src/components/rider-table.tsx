"use client";
import { useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { demoRiders } from "@/lib/demo-data";
export function RiderTable() {
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const rows = demoRiders.filter(r => r.name.toLowerCase().includes(name.trim().toLowerCase()) && r.contactNumber.includes(phone.trim()));
  return <section className="rounded-2xl border border-slate-200 bg-white">
    <div className="grid gap-4 border-b border-slate-200 p-6 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-sm font-medium">Rider Name<input value={name} onChange={e => setName(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="Search Rider name"/></label>
      <label className="text-sm font-medium">Mobile Number<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="Search contact number"/></label>
      <button onClick={() => {setName("");setPhone("");}} className="flex items-center gap-2 self-end rounded-lg border border-slate-300 px-4 py-2.5 text-sm"><RotateCcw size={16}/>Reset</button>
    </div>
    <div className="flex items-center gap-2 px-6 py-4 text-sm text-slate-500"><Search size={16}/><span role="status">{rows.length} sample Riders</span></div>
    <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Rider Name","Contact Number","Vehicle Type","Vehicle Number"].map(c => <th scope="col" className="px-6 py-4" key={c}>{c}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b border-slate-100 last:border-0"><td className="px-6 py-5 font-semibold">{r.name}</td><td className="px-6 py-5 text-slate-500">{r.contactNumber}</td><td className="px-6 py-5"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">{r.vehicleType}</span></td><td className="px-6 py-5 text-slate-500">{r.vehicleNumber ?? "—"}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No matching sample Riders.</p>}</div>
  </section>;
}
