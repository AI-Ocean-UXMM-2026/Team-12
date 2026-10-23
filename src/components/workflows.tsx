"use client";
import Link from "next/link";
import Image from "next/image";
import {Bell} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { expectedDeliveryDate } from "@/lib/dates";
import { upload } from "@vercel/blob/client";
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error?.message ?? body.message ?? "Request failed.");
  return body.data ?? body;
}
const base = "/api/v1/";
function useData<T>(url: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const refresh = useCallback(
    () =>
      api<T>(base + url)
        .then((d) => {
          setData(d);
          setError("");
        })
        .catch((e) => setError(e.message)),
    [url],
  );
  useEffect(() => {
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = setInterval(tick, 15000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);
  return { data, error, refresh };
}
export const label = (s: string | null | undefined) =>
  s
    ? ({
        HOME: "Receive at Home",
        NEIGHBOUR: "Leave with Neighbour",
        DOOR: "Leave at Door",
        LEFT_AT_DOOR: "Leave at Door",
        ON_THE_WAY: "On the Way",
        DELIVERED_HOME: "Delivered",
        DELIVERED_TO_NEIGHBOUR: "Delivered to Neighbour",
      }[s] ??
      s
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()))
    : "No result yet";
export function Message({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="my-4 rounded-lg bg-blue-50 p-3 text-sm">
      {children}
    </div>
  );
}
export function Field({
  name,
  title,
  type = "text",
  value,
  options,
  optionLabels,
  required = true,
}: {
  name: string;
  title: string;
  type?: string;
  value?: string;
  options?: string[];
  optionLabels?:Record<string,string>;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {title}
      {options ? (
        <select
          name={name}
          aria-label={title}
          defaultValue={value}
          required={required}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {optionLabels?.[o]??label(o)}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          aria-label={title}
          name={name}
          defaultValue={value}
          required={required}
          maxLength={2000}
        />
      ) : (
        <input
          aria-label={title}
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          maxLength={type === "password" ? 128 : 1000}
          step={type === "number" ? "0.01" : undefined}
          min={type === "number" ? "0" : undefined}
        />
      )}
    </label>
  );
}
export function ActionForm({
  children,
  submit,
  onSuccess,
  submitLabel = "Save",
}: {
  children: ReactNode;
  submit: (f: FormData, key: string) => Promise<unknown>;
  onSuccess?: (result: unknown) => void;
  submitLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const key = useRef("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    if (!key.current) key.current = crypto.randomUUID();
    try {
      const result = await submit(new FormData(e.currentTarget), key.current);
      setMessage("Saved successfully.");
      key.current = "";
      onSuccess?.(result);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="panel grid gap-5"
      onChange={() => {
        key.current = "";
      }}
    >
      {children}
      <button disabled={busy} type="submit">
        {busy ? "Saving…" : submitLabel}
      </button>
      {message && <Message>{message}</Message>}
    </form>
  );
}
const object = (f: FormData) => Object.fromEntries(f.entries());
const post = (url: string, data: unknown, key?: string) =>
  api(base + url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(data),
  });
export function Login({ setup = false }: { setup?: boolean }) {
  return (
    <ActionForm
      submit={async (f) => {
        if (setup) await post("password", object(f));
        else
          await api("/api/auth/sign-in/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(object(f)),
          });
        const me = await api<{ role: string; mustChangePassword: boolean }>(
          base + "me",
        );
        const destination = me.mustChangePassword
          ? "/setup"
          : me.role === "ADMIN"
            ? "/admin/parcels"
            : "/rider/assignments";
        window.location.assign(destination);
      }}
    >
      {setup ? (
        <>
          <Field
            name="currentPassword"
            title="Current setup password"
            type="password"
          />
          <Field
            name="newPassword"
            title="New password (at least 12 characters)"
            type="password"
          />
        </>
      ) : (
        <>
          <Field name="email" title="Login email" type="email" />
          <Field name="password" title="Password" type="password" />
        </>
      )}
    </ActionForm>
  );
}
export function SignOut({label="Sign out"}:{label?:string}) {
  return (
    <button
      onClick={async () => {
        await api("/api/auth/sign-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        // Clear cached authenticated navigation together with the browser session.
        window.location.replace(new URL("/login",window.location.origin).href);
      }}
    >
      {label}
    </button>
  );
}
export function Copy({ value }: { value: string }) {
  const [message, setMessage] = useState("");
  return (
    <span>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          navigator.clipboard
            .writeText(value)
            .then(() => setMessage("Copied"))
            .catch(() => setMessage("Select and copy the text manually."))
        }
      >
        Copy
      </button>{" "}
      <span role="status">{message}</span>
    </span>
  );
}
export function Tracking({ result = false }: { result?: boolean }) {
  const router = useRouter();
  if (!result)
    return (
      <ActionForm
        submitLabel="Track"
        submit={(f) => post("tracking/exchange", object(f))}
        onSuccess={() => router.push("/track/result")}
      >
        <Field name="code" title="Parcel code" />
        <p>Enter the parcel code shown on your delivery receipt, such as P-….</p>
      </ActionForm>
    );
  return <TrackingResult />;
}
interface TrackingData {
  parcelCode: string;
  customerStatus: string;
  receivingOption: string;
  deliveryInstruction: string | null;
  version: number;
  currentAssignment: {
    deliveryDate: string;
    expectedDeliveryDate: string;
  } | null;
}
function TrackingResult() {
  const router = useRouter();
  const { data: p, error, refresh } = useData<TrackingData>("tracking");
  if (!p)
    return (
      <Message>
        {error || "Loading tracking details…"}{" "}
        <Link href="/track">Enter parcel code</Link>
      </Message>
    );
  return (
    <>
      <div className="panel">
        <h2>{p.parcelCode}</h2>
        <p className="text-xl my-3">{label(p.customerStatus)}</p>
        {p.currentAssignment && (
          <p>
            Scheduled: {p.currentAssignment.deliveryDate.slice(0, 10)} ·
            Expected: {p.currentAssignment.expectedDeliveryDate.slice(0, 10)}
          </p>
        )}
      </div>
      {error && <Message>{error}</Message>}
      {p.customerStatus === "DELIVERED" ? (
        <Message>
          Delivered. {label(p.receivingOption)} · {p.deliveryInstruction}
        </Message>
      ) : (
        <PreferenceForm p={p} refresh={refresh} />
      )}
      <button
        className="secondary"
        onClick={async () => {
          await post("tracking/clear", {});
          router.push("/track");
        }}
      >
        Track another parcel
      </button>
    </>
  );
}
function PreferenceForm({
  p,
  refresh,
}: {
  p: TrackingData;
  refresh: () => void;
}) {
  // Keep the version from when editing began; polling must not silently bless a stale form.
  const [version, setVersion] = useState(p.version);
  return (
    <ActionForm
      submit={(f) => post("tracking/preferences", { ...object(f), version })}
      onSuccess={async () => {
        const latest = await api<TrackingData>(base + "tracking");
        setVersion(latest.version);
        refresh();
      }}
    >
      <Field
        name="receivingOption"
        title="Receiving place"
        value={p.receivingOption}
        options={["HOME", "NEIGHBOUR", "DOOR"]}
      />
      <Field
        name="deliveryInstruction"
        title="Delivery instructions"
        type="textarea"
        required={false}
        value={p.deliveryInstruction ?? ""}
      />
      <p>
        Review refreshed details before retrying a conflict.{" "}
        <button
          type="button"
          className="secondary"
          onClick={() => window.location.reload()}
        >
          Refresh details
        </button>
      </p>
    </ActionForm>
  );
}
interface Rider {
  id: string;
  name: string;
  contactNumber: string;
  vehicleType: string;
  vehicleNumber: string | null;
  active: boolean;
  version: number;
  user: { email: string } | null;
}
interface Parcel extends TrackingData {
  id: string;
  customerName: string;
  customerContactNumber: string;
  senderName: string;
  receivedDate: string;
  receivedPerson: string;
  township: string;
  address: string;
  deliveryNote: string | null;
  paymentType: string;
  orderAmount: string | null;
  deliveryFee: string;
  currency: string;
  currentAssignmentId: string | null;
  currentAssignment: Assignment | null;
  assignments: Assignment[];
}
interface Attempt {
  id: string;
  result: string;
  submittedAt: string;
  photoAssetId: string | null;
}
interface Assignment {
  id: string;
  riderId: string;
  parcelId: string;
  assignDate: string;
  deliveryDate: string;
  expectedDeliveryDate: string;
  lifecycle: string;
  latestResult: string | null;
  rider: { name: string };
  parcel: Parcel;
  attempts: Attempt[];
}
function Filters({
  kind,
  onChange,
  initialDate,
  showRiders = false,
}: {
  kind: string;
  onChange: (s: string) => void;
  initialDate?: string;
  showRiders?: boolean;
}) {
  return (
    <form
      className="panel flex flex-wrap gap-4 mb-5"
      onSubmit={(e) => {
        e.preventDefault();
        onChange(
          new URLSearchParams(
            object(new FormData(e.currentTarget)) as Record<string, string>,
          ).toString(),
        );
      }}
    >
      {kind === "riders" ? (
        <>
          <Field name="name" title="Rider Name" required={false} />
          <Field name="phone" title="Mobile Number" required={false} />
        </>
      ) : (
        <>
          <Field name="code" title="Parcel Code" required={false} />
          {kind === "parcels" ? (
            <Field name="customer" title="Customer Name" required={false} />
          ) : (
            <Field
              name="date"
              title="Delivery Date"
              type="date"
              value={initialDate}
              required={false}
            />
          )}
        </>
      )}
      {showRiders && <RiderFilter />}
      <button>Search</button>
      <button className="secondary" type="reset" onClick={() => onChange("")}>
        Reset
      </button>
    </form>
  );
}
function RiderFilter() {
  const { data } = useData<Rider[]>("admin/riders");
  return (
    <label>
      Assigned Rider
      <select name="rider">
        <option value="">All Riders</option>
        {data?.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Listing({
  kind,
  rider = false,
  initialDate,
}: {
  kind: "riders" | "parcels" | "assignments";
  rider?: boolean;
  initialDate?: string;
}) {
  const [query, setQuery] = useState(initialDate ? `date=${initialDate}` : "");
  const [page, setPage] = useState(1);
  const prefix = rider ? "rider" : "admin";
  const { data, error } = useData<(Rider | Parcel | Assignment)[]>(
    `${prefix}/${kind}?page=${page}&${query}`,
  );
  return (
    <>
      <div className="flex gap-4 mb-5">
        {!rider && (
          <Link className="button" href={`/admin/${kind}/new`}>
            Create{" "}
            {kind === "riders"
              ? "Rider"
              : kind === "parcels"
                ? "parcel"
                : "assignment"}
          </Link>
        )}
      </div>
      <Filters
        kind={kind}
        initialDate={initialDate}
        showRiders={kind === "assignments" && !rider}
        onChange={(s) => {
          setQuery(s || (initialDate ? `date=${initialDate}` : ""));
          setPage(1);
        }}
      />
      {error && <Message>{error}</Message>}
      <div className="panel overflow-x-auto">
        <table>
          <thead>
            <tr>
              {(kind === "riders"
                ? [
                    "Rider Name",
                    "Contact Number",
                    "Vehicle Type",
                    "Vehicle Number",
                    "Active",
                    "Actions",
                  ]
                : kind === "parcels"
                  ? [
                      "Parcel Code",
                      "Customer Name",
                      "Customer Contact Number",
                      "Payment Type",
                      "Customer status",
                      "Rider result",
                    ]
                  : rider
                    ? [
                        "Parcel Code",
                        "Customer Name",
                        "Customer Contact Number",
                        "Township",
                        "Customer status",
                        "Rider result",
                      ]
                    : [
                        "Parcel Code",
                        "Assigned Rider",
                        "Assign Date",
                        "Delivery Date",
                        "Customer status",
                        "Rider result",
                      ]
              ).map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.map((row) =>
              kind === "riders"
                ? (() => {
                    const r = row as Rider;
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/admin/riders/${r.id}`}>{r.name}</Link>
                        </td>
                        <td>{r.contactNumber}</td>
                        <td>{label(r.vehicleType)}</td>
                        <td>{r.vehicleNumber || "—"}</td>
                        <td>{r.active ? "Active" : "Inactive"}</td>
                        <td>
                          <Link href={`/admin/riders/${r.id}/edit`}>Edit</Link>
                        </td>
                      </tr>
                    );
                  })()
                : kind === "parcels"
                  ? (() => {
                      const p = row as Parcel;
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link href={`/admin/parcels/${p.id}`}>
                              {p.parcelCode}
                            </Link>
                          </td>
                          <td>{p.customerName}</td>
                          <td>{p.customerContactNumber}</td>
                          <td>{p.paymentType}</td>
                          <td>{label(p.customerStatus)}</td>
                          <td>{label(p.currentAssignment?.latestResult)}</td>
                        </tr>
                      );
                    })()
                  : (() => {
                      const a = row as Assignment;
                      return (
                        <tr key={a.id}>
                          <td>
                            <Link href={`/${prefix}/assignments/${a.id}`}>
                              {a.parcel.parcelCode}
                            </Link>
                          </td>
                          {rider ? (
                            <>
                              <td>{a.parcel.customerName}</td>
                              <td>
                                {a.parcel.customerContactNumber}{" "}
                                <Copy value={a.parcel.customerContactNumber} />
                              </td>
                              <td>{a.parcel.township}</td>
                            </>
                          ) : (
                            <>
                              <td>{a.rider.name}</td>
                              <td>{a.assignDate.slice(0, 10)}</td>
                              <td>{a.deliveryDate.slice(0, 10)}</td>
                            </>
                          )}
                          <td>{label(a.parcel.customerStatus)}</td>
                          <td>{label(a.latestResult)}</td>
                        </tr>
                      );
                    })(),
            )}
          </tbody>
        </table>
        {!data ? (
          <p>Loading…</p>
        ) : !data.length ? (
          <p>No matching records.</p>
        ) : null}
      </div>
      <div className="flex items-center gap-4 mt-5">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button
          disabled={!data || data.length < 25}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
export function RiderEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { data: r, error } = useData<Rider>(id ? `admin/riders/${id}` : "me");
  const [credential, setCredential] = useState("");
  if (id && !r) return <Message>{error || "Loading Rider…"}</Message>;
  return (
    <>
      {credential && (
        <Message>
          One-time setup password (shown for this response only):{" "}
          <strong>{credential}</strong>
          <p>
            Give this privately to the Rider. They must change it at first
            login.
          </p>
        </Message>
      )}
      <ActionForm
        submit={async (f) => {
          const values = object(f);
          return post(`admin/riders${id ? `/${id}` : ""}`, {
            ...values,
            ...(id
              ? {
                  version: r!.version,
                  active: f.get("active") === "true",
                  resetAccess: f.get("resetAccess") === "on",
                }
              : {}),
          });
        }}
        onSuccess={(result) => {
          const value = result as { id: string; setupPassword?: string };
          setCredential(value.setupPassword ?? "");
          if (!value.setupPassword) router.push(`/admin/riders/${value.id}`);
        }}
      >
        <Field name="name" title="Rider Name" value={id ? r?.name : ""} />
        <Field
          name="contactNumber"
          title="Contact Number"
          value={id ? r?.contactNumber : ""}
        />
        <Field
          name="vehicleType"
          title="Vehicle Type"
          value={id ? r?.vehicleType : "DELIVERY_VAN"}
          options={["DELIVERY_VAN", "CAR", "BICYCLE"]}
        />
        <Field
          name="vehicleNumber"
          title="Vehicle Number"
          required={false}
          value={id ? (r?.vehicleNumber ?? "") : ""}
        />
        {id ? (
          <>
            <Field
              name="active"
              title="Account active"
              value={String(r?.active)}
              options={["true", "false"]}
            />
            <label>
              <input type="checkbox" name="resetAccess" /> Revoke sessions and
              issue a new setup password
            </label>
          </>
        ) : (
          <Field name="email" title="Login email" type="email" />
        )}
      </ActionForm>
    </>
  );
}
export function ParcelCreate() {
  const router = useRouter();
  return (
    <ActionForm
      submit={(f, key) =>
        post(
          "admin/parcels",
          { ...object(f), orderAmount: f.get("orderAmount") || null },
          key,
        )
      }
      onSuccess={(v) => {
        router.push(`/admin/parcels/${(v as { id: string }).id}`);
      }}
    >
      <h2>From</h2>
      <Field name="senderName" title="Business/Person Name" />
      <Field name="receivedDate" title="Received Date" type="date" />
      <Field name="receivedPerson" title="Received Person" />
      <h2>To</h2>
      <Field name="customerName" title="Customer Name" />
      <Field name="customerContactNumber" title="Contact Number" />
      <Field
        name="paymentType"
        title="Payment Type"
        options={["PREPAID", "COD"]}
      />
      <Field
        name="orderAmount"
        title="Order Amount (required for COD)"
        type="number"
        required={false}
      />
      <Field name="deliveryFee" title="Delivery Fee" type="number" />
      <Field name="township" title="Township" />
      <Field name="address" title="Address" type="textarea" />
      <Field
        name="deliveryNote"
        title="Delivery Note"
        type="textarea"
        required={false}
      />
    </ActionForm>
  );
}
function Proof({ attempts }: { attempts: Attempt[] }) {
  return (
    <section className="panel">
      <h2>Delivery attempts</h2>
      {attempts.length ? (
        attempts.map((a) => (
          <p key={a.id} className="my-3">
            {new Date(a.submittedAt).toLocaleString()} · {label(a.result)}{" "}
            {a.photoAssetId && (
              <a
                target="_blank"
                rel="noreferrer"
                href={`/api/v1/photos/${a.photoAssetId}`}
              >
                View private photo
              </a>
            )}
          </p>
        ))
      ) : (
        <p>No delivery attempts yet.</p>
      )}
    </section>
  );
}
export function ParcelDetail({ id }: { id: string }) {
  const { data: p, error } = useData<Parcel>(`admin/parcels/${id}`);
  if (!p) return <Message>{error || "Loading parcel…"}</Message>;
  return (
    <>
      <div className="panel">
        <h2>{p.parcelCode}</h2>
        <dl>
          {[
            "senderName",
            "receivedDate",
            "receivedPerson",
            "customerName",
            "customerContactNumber",
            "paymentType",
            "orderAmount",
            "deliveryFee",
            "currency",
            "township",
            "address",
            "deliveryNote",
            "receivingOption",
            "deliveryInstruction",
            "customerStatus",
          ].map((k) => (
            <div key={k} className="my-3">
              <dt className="font-semibold">{k.replace(/([A-Z])/g, " $1")}</dt>
              <dd>{String(p[k as keyof Parcel] ?? "—")}</dd>
            </div>
          ))}
        </dl>
        <p>
          Parcel code: <code>{p.parcelCode}</code>{" "}
          <Copy value={p.parcelCode} />
        </p>
        {p.customerStatus !== "DELIVERED" && (
          <Link href={`/admin/assignments/new?parcel=${id}`}>
            Manage assignment
          </Link>
        )}
      </div>
      <h2>Assignment history</h2>
      {p.assignments.map((a) => (
        <div key={a.id} className="panel">
          <Link href={`/admin/assignments/${a.id}`}>
            {a.rider.name} · {a.deliveryDate.slice(0, 10)} ·{" "}
            {label(a.lifecycle)}
          </Link>
          <Proof attempts={a.attempts} />
        </div>
      ))}
    </>
  );
}
export function AssignmentCreate({ parcelId }: { parcelId?: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState(parcelId ?? "");
  const [q, setQ] = useState("");
  const { data: parcels } = useData<Parcel[]>(
    `admin/parcels?code=${encodeURIComponent(q)}`,
  );
  const [riderSearch, setRiderSearch] = useState("");
  const { data: riders } = useData<Rider[]>(
    `admin/riders?name=${encodeURIComponent(riderSearch)}`,
  );
  const { data: p } = useData<Parcel>(
    selected ? `admin/parcels/${selected}` : "me",
  );
  const [delivery, setDelivery] = useState("");
  return (
    <>
      <label>
        Find parcel by code
        <input value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <label>
        Parcel
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose parcel</option>
          {parcels?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.parcelCode} · {label(p.customerStatus)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Find Rider by name
        <input
          value={riderSearch}
          onChange={(e) => setRiderSearch(e.target.value)}
        />
      </label>
      {selected && p?.id && (
        <ActionForm
          key={selected}
          submit={(f, key) =>
            post(
              "admin/assignments",
              { ...object(f), parcelId: selected, version: p.version },
              key,
            )
          }
          onSuccess={(v) => {
            router.push(`/admin/assignments/${(v as { id: string }).id}`);
          }}
        >
          <Field
            name="mode"
            title="Action"
            options={
              p.currentAssignmentId ? ["reschedule", "reassign"] : ["assign"]
            }
          />
          <label>
            Rider
            <select
              name="riderId"
              aria-label="Rider"
              defaultValue={p.currentAssignment?.riderId}
              required
            >
              {riders
                ?.filter((r) => r.active && r.user)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </label>
          <Field name="assignDate" title="Assign Date" type="date" />
          <label>
            Delivery Date
            <input
              name="deliveryDate"
              type="date"
              required
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
          </label>
          <p>
            Expected delivery:{" "}
            {delivery
              ? expectedDeliveryDate(delivery)
              : "Choose a delivery date"}
          </p>
        </ActionForm>
      )}
    </>
  );
}
export function AssignmentDetail({
  id,
  rider = false,
}: {
  id: string;
  rider?: boolean;
}) {
  const {
    data: a,
    error,
    refresh,
  } = useData<Assignment>(`${rider ? "rider" : "admin"}/assignments/${id}`);
  if (!a) return <Message>{error || "Loading assignment…"}</Message>;
  return (
    <>
      {error && <Message>{error}</Message>}
      <div className="panel">
        <h2>
          {a.parcel.parcelCode} · {a.rider.name}
        </h2>
        <p>
          Assigned {a.assignDate.slice(0, 10)} · Scheduled{" "}
          {a.deliveryDate.slice(0, 10)} · Expected{" "}
          {a.expectedDeliveryDate.slice(0, 10)}
        </p>
        <p>
          Customer status: {label(a.parcel.customerStatus)} · Rider result:{" "}
          {label(a.latestResult)} · {label(a.lifecycle)}
        </p>
        <p>
          {a.parcel.customerName} · {a.parcel.customerContactNumber}{" "}
          <Copy value={a.parcel.customerContactNumber} />
        </p>
        <p>
          {a.parcel.township} · {a.parcel.address}
        </p>
        <p>Receiving place: {label(a.parcel.receivingOption)}</p>
        <p>Instructions: {a.parcel.deliveryInstruction || "None"}</p>
        <p>Delivery note: {a.parcel.deliveryNote || "None"}</p>
      </div>
      <Proof attempts={a.attempts} />
      {a.lifecycle === "ACTIVE" &&
        (rider ? (
          <ResultForm a={a} refresh={refresh} />
        ) : (
          <Link href={`/admin/assignments/new?parcel=${a.parcelId}`}>
            Reschedule or reassign
          </Link>
        ))}
    </>
  );
}
function ResultForm({ a, refresh }: { a: Assignment; refresh: () => void }) {
  const [version, setVersion] = useState(a.parcel.version);
  const [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <ActionForm
      submitLabel="Submit"
      submit={async (f, key) => {
        f.set("version", String(version));
        f.set("idempotencyKey", key);
        const file = f.get("photo");
        if (file instanceof File && file.size > 0) {
          if (file.size > 10485760) throw new Error("Photo must be at most 10 MiB.");
          if (!["image/jpeg", "image/png"].includes(file.type)) throw new Error("Choose a JPEG or PNG photo.");
          const ticket = await api<{ mode: "blob" | "multipart"; id?: string; pathname?: string }>(
            base + `rider/assignments/${a.id}/photo-upload`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idempotencyKey: key }),
            });
          if (ticket.mode === "blob") {
            await upload(ticket.pathname!, file, { access: "private", handleUploadUrl: "/api/blob/upload",
              clientPayload: JSON.stringify({ ticketId: ticket.id }),
              contentType: file.type, multipart: true });
            return api(base + `rider/assignments/${a.id}/results`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ result: f.get("result"), version, idempotencyKey: key, uploadId: ticket.id }),
            });
          }
        }
        return api(base + `rider/assignments/${a.id}/results`, {
          method: "POST",
          body: f,
        });
      }}
      onSuccess={async () => {
        const latest = await api<Assignment>(
          base + `rider/assignments/${a.id}`,
        );
        setVersion(latest.parcel.version);
        refresh();
      }}
    >
      <Field
        name="result"
        title="Delivery result"
        optionLabels={{DELIVERED_HOME:"Delivered"}}
        options={[
          "CUSTOMER_UNREACHABLE",
          "DELIVERED_HOME",
          "DELIVERED_TO_NEIGHBOUR",
          "LEFT_AT_DOOR",
        ]}
      />
      <label>
        Delivery photo (one JPEG/PNG, up to 10 MiB)
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png"
          onChange={(e) =>
            setPreview(
              e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : "",
            )
          }
        />
      </label>
      {preview && (
        <>
          <Image
            width={640}
            height={480}
            unoptimized
            alt="Selected delivery proof"
            src={preview}
            className="max-h-60 object-contain"
          />
          <button
            type="button"
            className="secondary"
            onClick={(e) => {
              const input =
                e.currentTarget.form?.querySelector<HTMLInputElement>(
                  'input[type="file"]',
                );
              if (input) input.value = "";
              setPreview("");
            }}
          >
            Remove photo
          </button>
        </>
      )}
      <p>
        Photo is required for successful delivery. If details changed, refresh
        and review before submitting.
      </p>
      <button
        type="button"
        className="secondary"
        onClick={() => window.location.reload()}
      >
        Refresh latest instructions
      </button>
    </ActionForm>
  );
}
interface Notification {
  id: string;
  assignmentId: string | null;
  readAt: string | null;
  deliveryDate: string | null;
  createdAt: string;
  snapshot: {
    parcelCode: string;
    customerName?: string;
    customerContactNumber?: string;
    receivingOption?: string;
    deliveryInstruction?: string;
    message: string;
  };
}
export function Notifications() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState("");
  const { data, error, refresh } = useData<{
    items: Notification[];
    unread: number;
  }>(`rider/notifications?${query}&page=${page}`);
  return (
    <>
      <h2>🔔 {data?.unread ?? 0} unread</h2>
      <Filters
        kind="notifications"
        onChange={(s) => {
          setQuery(s);
          setPage(1);
        }}
      />
      {error && <Message>{error}</Message>}
      {actionError && <Message>{actionError}</Message>}
      {data?.items.map((n) => (
        <article key={n.id} className="panel">
          <p>{n.snapshot.message}</p>
          <dl className="my-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold">Delivery Date</dt><dd>{n.deliveryDate?.slice(0,10)??"—"}</dd></div>
            <div><dt className="font-semibold">Parcel Code</dt><dd>{n.snapshot.parcelCode}</dd></div>
            {n.snapshot.customerName&&<>
              <div><dt className="font-semibold">Customer Name</dt><dd>{n.snapshot.customerName}</dd></div>
              <div><dt className="font-semibold">Customer Contact Number</dt><dd>{n.snapshot.customerContactNumber}</dd></div>
              <div><dt className="font-semibold">Receive Place</dt><dd>{label(n.snapshot.receivingOption)}</dd></div>
              <div><dt className="font-semibold">Instruction</dt><dd>{n.snapshot.deliveryInstruction||"None"}</dd></div>
            </>}
          </dl>
          <p>Created: {new Date(n.createdAt).toLocaleString()}</p>
          {n.assignmentId ? (
            <Link href={`/rider/assignments/${n.assignmentId}`}>
              Open assignment (current access required)
            </Link>
          ) : (
            <p>Assignment unavailable.</p>
          )}
          {!n.readAt && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await post(`rider/notifications/${n.id}/read`, {});
                  setActionError("");
                  await refresh();
                } catch (error) {
                  setActionError(
                    error instanceof Error
                      ? error.message
                      : "Unable to mark notification read.",
                  );
                }
              }}
            >
              Mark read
            </button>
          )}
        </article>
      ))}
      {data && !data.items.length && <Message>No notifications.</Message>}
      <button disabled={page === 1} onClick={() => setPage(page - 1)}>
        Previous
      </button>{" "}
      <button
        disabled={!data || data.items.length < 25}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </>
  );
}
export function NotificationBell() {
  const { data } = useData<{ unread: number }>("rider/notifications");
  return (
    <Link href="/rider/notifications" aria-label={`Notifications (${data?.unread??0} unread)`} className="relative inline-flex items-center justify-center rounded-full border border-slate-200 p-3 text-blue-700">
      <Bell size={20} aria-hidden="true"/>
      {!!data?.unread&&<span aria-hidden="true" className="absolute -right-2 -top-2 rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{data.unread>99?"99+":data.unread}</span>}
    </Link>
  );
}
