import Link from "next/link";
import { Package } from "lucide-react";
import { NotificationBell, SignOut } from "./workflows";

export function CustomerShell({children,title}:{children:React.ReactNode;title:string}) {
  return <div className="min-h-screen">
    <header className="border-b border-slate-200 bg-white px-5 py-5">
      <div className="mx-auto max-w-2xl"><Link href="/track" className="inline-flex items-center gap-2 text-lg font-bold"><Package aria-hidden="true"/>ParcelFlow</Link></div>
    </header>
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-700">Parcel tracking</p>
      <h1 className="mb-3 text-3xl font-semibold">{title}</h1>
      <p className="mb-7 text-slate-600">Track your delivery and choose how you would like to receive it.</p>
      {children}
    </main>
  </div>;
}

export function RiderShell({children,title}:{children:React.ReactNode;title:string}) {
  return <div className="min-h-screen">
    <header className="border-b border-slate-200 bg-white p-4 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <Link href="/rider/assignments" className="inline-flex items-center gap-2 text-lg font-bold"><Package aria-hidden="true"/>ParcelFlow</Link>
        <nav aria-label="Rider navigation" className="flex flex-wrap items-center gap-3 sm:gap-5">
          <Link href="/rider/assignments" className="font-semibold text-blue-700">My Deliveries</Link>
          <NotificationBell/>
          <SignOut/>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-6xl p-5 sm:p-8">
      <h1 className="mb-6 text-3xl font-semibold">{title}</h1>
      {children}
    </main>
  </div>;
}

export function StaffAuthShell({children,title}:{children:React.ReactNode;title:string}) {
  return <div className="min-h-screen"><main className="mx-auto max-w-md px-5 py-12"><div className="mb-8 flex items-center gap-2 text-xl font-bold"><Package aria-hidden="true"/>ParcelFlow</div><h1 className="mb-6 text-3xl font-semibold">{title}</h1>{children}</main></div>;
}
