import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Building2,
  CreditCard,
  BedDouble,
  MessageCircle,
  Sparkles,
  Download,
  Check,
  X,
  FileCheck,
  LifeBuoy,
  Bell,
  Smartphone,
  Landmark,
  LoaderCircle,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { api, money, dateLabel, type Hostel, type User } from "./api";
import { Portfolio } from "./portfolio";
import {
  useApp,
  useLoad,
  Field,
  Badge,
  Modal,
  Loading,
  Empty,
  ErrorBox,
  PageTitle,
} from "./shared";
function WorkQueues({ stats, owner = false }: { stats: any; owner?: boolean }) {
  return (
    <div className="work-queue-links">
      {owner && (
        <Link to="/bookings?queue=attention">
          <b>
            {stats.booking_requests + stats.stays_to_complete} bookings need
            attention
          </b>
          <span>
            {stats.booking_requests} requests · {stats.stays_to_complete} stays
            ready to complete
          </span>
          <ArrowRight size={18} />
        </Link>
      )}
      <Link to="/bookings?queue=refunds">
        <b>{money(stats.refund_total)} awaiting refund</b>
        <span>
          {stats.pending_refunds} refunds {owner ? "with admin" : "to process"}
        </span>
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}
function Stats({ stats }: { stats: any }) {
  return (
    <div className="stats-grid">
      {[
        ["Total listings", stats.listings, Building2],
        ["Bookings", stats.bookings, CalendarDays],
        ["Net booking revenue", money(stats.revenue), CreditCard],
        ["Occupied beds today", stats.occupancy, BedDouble],
      ].map(([title, value, I]: any) => (
        <div className="stat" key={title}>
          <span>
            {title}
            <I size={19} />
          </span>
          <strong>{value}</strong>
          <small>
            {title.includes("revenue")
              ? "Demo payments, less processed refunds"
              : "Across your managed properties"}
          </small>
        </div>
      ))}
    </div>
  );
}
const defaultHostel = {
  min_stay_days: 30,
  food_charge: 0,
  service_charge: 0,
  tax_percent: 0,
  name: "",
  city: "Chennai",
  area: "",
  address: "",
  description: "",
  gender: "Co-living",
  facilities: ["Wi-Fi", "Security"],
  photos: [] as string[],
  deposit: 3000,
  discount: 0,
  latitude: 13.0827,
  longitude: 80.2707,
  nearby: "",
  check_in: "12:00",
  check_out: "10:00",
  contact: "",
  refund_policy:
    "Full refund before move-in. After move-in, only the deposit is refundable.",
};
export function Owner() {
  const [property, setProperty] = useState("");
  const { user, toast, config } = useApp();
  const { data, error, load } = useLoad("/dashboard");
  const listings = useLoad("/owner/hostels");
  const [edit, setEdit] = useState<any>(null),
    [rooms, setRooms] = useState<Hostel | null>(null),
    [doc, setDoc] = useState<Hostel | null>(null);
  const plan = config.plans?.find((p: any) => p.code === user?.plan);
  const propertyCount = listings.data?.hostels.length || 0;
  const reload = async () => {
    await Promise.all([load(), listings.load()]);
  };
  return (
    <div className="page">
      <PageTitle
        eyebrow="OWNER WORKSPACE"
        title={`A warm welcome, ${user?.name.split(" ")[0]}.`}
        subtitle="Great hosting starts with the little things. Let’s take care of them."
      >
        <button
          className="button"
          disabled={!!plan && propertyCount >= plan.maxProperties}
          onClick={() => setEdit({ ...defaultHostel })}
          title={
            plan && propertyCount >= plan.maxProperties
              ? `${plan.name} allows ${plan.maxProperties} properties`
              : "Add a property"
          }
        >
          <Plus size={17} />
          Add a property
        </button>
      </PageTitle>
      <ErrorBox error={error} />
      <Portfolio property={property} onProperty={setProperty} />
      <div className="dashboard-shortcuts">
        <Link to="/bookings">
          <CalendarDays size={19} />
          Booking requests
          <ArrowUpRight size={17} />
        </Link>
        <Link to="/messages">
          <MessageCircle size={19} />
          Guest messages
          <ArrowUpRight size={17} />
        </Link>
        <Link to="/owner/plans">
          <Sparkles size={19} />
          {user?.plan} plan
          <ArrowUpRight size={17} />
        </Link>
        {plan?.reportExports ? (
          <a href="/api/reports/bookings.csv">
            <Download size={19} />
            Export bookings
            <ArrowUpRight size={17} />
          </a>
        ) : (
          <Link to="/owner/plans">
            <Download size={19} />
            Advanced reports
            <ArrowUpRight size={17} />
          </Link>
        )}
      </div>
      <div className="section-heading">
        <div>
          <h2>Your properties</h2>
          <p>Published homes and the ones in progress.</p>
        </div>
      </div>
      <ErrorBox error={listings.error} />
      {!listings.data && !listings.error ? (
        <Loading />
      ) : listings.data?.hostels.length ? (
        <div className="owner-listings">
          {listings.data.hostels
            .filter((h: Hostel) => !property || h.id === property)
            .map((h: Hostel) => (
              <article className="owner-property" key={h.id}>
                <img src={h.photos[0] || "/images/room-1.jpg"} alt={h.name} />
                <div>
                  <div className="card-meta">
                    <Badge status={h.status}>{h.status}</Badge>
                    <small>{h.rooms.length} room types</small>
                  </div>
                  <h3>{h.name}</h3>
                  <p>
                    {h.area}, {h.city} · from {money(h.min_rent)}/month
                  </p>
                  {h.verification_note && (
                    <small className="verification-note">
                      Review note: {h.verification_note}
                    </small>
                  )}
                  <div className="booking-actions">
                    <button
                      className="button secondary small"
                      onClick={() => setEdit(h)}
                    >
                      Edit listing
                    </button>
                    <button
                      className="button secondary small"
                      onClick={() => setRooms(h)}
                    >
                      Rooms & pricing
                    </button>
                    <button
                      className="button secondary small"
                      onClick={() => setDoc(h)}
                    >
                      Documents ({h.documents?.length || 0})
                    </button>
                    {["draft", "rejected", "pending"].includes(h.status) && (
                      <button
                        className="button small"
                        onClick={async () => {
                          try {
                            await api(
                              "/owner/hostels/" + h.id + "/submit",
                              "POST",
                            );
                            toast("Listing submitted for verification.");
                            await reload();
                          } catch (e) {
                            toast((e as Error).message);
                          }
                        }}
                      >
                        Submit for review
                      </button>
                    )}
                    <Link className="text-button" to={"/hostels/" + h.id}>
                      Preview
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
        </div>
      ) : (
        <Empty
          title="Your first home starts here"
          body="Add a property, upload documents and submit for review."
        />
      )}
      {data && (
        <section className="panel">
          <h2>Payment activity</h2>
          <PaymentTable
            payments={data.payments.filter(
              (p: any) => !property || p.hostel_id === property,
            )}
          />
        </section>
      )}
      {edit && (
        <ListingEditor
          initial={edit}
          onClose={() => setEdit(null)}
          onSave={async () => {
            setEdit(null);
            await reload();
          }}
        />
      )}
      {rooms && (
        <RoomEditor
          hostel={rooms}
          onClose={() => setRooms(null)}
          onSave={reload}
        />
      )}{" "}
      {doc && (
        <Modal title={"Documents · " + doc.name} onClose={() => setDoc(null)}>
          <p>
            Upload a registration certificate or ownership document. Only you
            and administrators can download it. For this demo, use a sample
            document without personal information.
          </p>
          {doc.documents?.map((d) => (
            <a
              className="document-link"
              key={d.id}
              href={"/api/documents/" + d.id}
            >
              <FileCheck size={18} />
              {d.name}
              <Download size={16} />
            </a>
          ))}
          <Field label="Upload PDF or image (up to 8 MB)">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const form = new FormData();
                form.append("file", f);
                try {
                  await api(
                    "/owner/hostels/" + doc.id + "/documents",
                    "POST",
                    form,
                  );
                  toast("Document uploaded. You can now submit for review.");
                  setDoc(null);
                  await reload();
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
function ListingEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: any;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const { toast, config, user } = useApp();
  const [h, setH] = useState({ ...initial }),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const plan = config.plans?.find((p: any) => p.code === user?.plan);
  const maxPhotos = plan?.maxPhotosPerProperty || 8;
  const change = (k: string, v: any) => setH((x: any) => ({ ...x, [k]: v }));
  const [firstRoom, setFirstRoom] = useState({
    name: "Twin room",
    sharing: 2,
    rent: 7500,
    capacity: 4,
    ac: false,
  });
  return (
    <Modal
      title={h.id ? "Edit your property" : "A new place to call home"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(
              "/owner/hostels" + (h.id ? "/" + h.id : ""),
              h.id ? "PATCH" : "POST",
              { ...h, ...(!h.id ? { rooms: [firstRoom] } : {}) },
            );
            toast(
              "Listing saved as a draft. Submit it for verification when ready.",
            );
            await onSave();
          } catch (e) {
            toast((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="info-box">
          Changes to listing details return the property to draft for
          verification. Existing reservations stay valid.
        </div>
        <div className="two-col">
          {[
            ["name", "Property name"],
            ["city", "City"],
            ["area", "Neighbourhood"],
            ["contact", "Contact phone"],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <input
                required
                maxLength={k === "contact" ? 30 : 100}
                value={h[k]}
                onChange={(e) => change(k, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <Field label="Full address">
          <input
            required
            maxLength={500}
            value={h.address}
            onChange={(e) => change("address", e.target.value)}
          />
        </Field>
        <Field label="What makes this place special?">
          <textarea
            required
            maxLength={4000}
            value={h.description}
            onChange={(e) => change("description", e.target.value)}
          />
        </Field>
        <div className="two-col">
          <Field label="Who is it for?">
            <select
              value={h.gender}
              onChange={(e) => change("gender", e.target.value)}
            >
              {["Boys", "Girls", "Co-living"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Nearby colleges / offices">
            <input
              required
              maxLength={1000}
              value={h.nearby}
              onChange={(e) => change("nearby", e.target.value)}
            />
          </Field>
          {[
            ["deposit", "Deposit (INR)", 0, 200000],
            ["discount", "Rent discount (%)", 0, 50],
            ["min_stay_days", "Minimum stay (nights)", 30, 180],
            ["food_charge", "Monthly food plan per bed (INR)", 0, 15000],
            [
              "service_charge",
              "Monthly service charge per bed (INR)",
              0,
              10000,
            ],
            ["tax_percent", "Configured tax (%)", 0, 30],
            ["latitude", "Latitude", -90, 90],
            ["longitude", "Longitude", -180, 180],
          ].map(([k, l, min, max]) => (
            <Field key={k as string} label={l as string}>
              <input
                required
                type="number"
                step={k === "latitude" || k === "longitude" ? "any" : "1"}
                min={min as number}
                max={max as number}
                value={h[k as string]}
                disabled={k === "discount" && !plan?.specialOffers}
                onChange={(e) => change(k as string, Number(e.target.value))}
              />
            </Field>
          ))}
          <Field label="Check-in time">
            <input
              required
              type="time"
              value={h.check_in}
              onChange={(e) => change("check_in", e.target.value)}
            />
          </Field>
          <Field label="Check-out time">
            <input
              required
              type="time"
              value={h.check_out}
              onChange={(e) => change("check_out", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Additional house / refund policy">
          <textarea
            required
            maxLength={1000}
            value={h.refund_policy}
            onChange={(e) => change("refund_policy", e.target.value)}
          />
        </Field>
        <h3>Facilities</h3>
        <div className="filter-facilities">
          {config.facilities?.map((f: string) => (
            <label key={f}>
              <input
                type="checkbox"
                checked={h.facilities.includes(f)}
                onChange={() =>
                  change(
                    "facilities",
                    h.facilities.includes(f)
                      ? h.facilities.filter((x: string) => x !== f)
                      : [...h.facilities, f],
                  )
                }
              />
              {f}
            </label>
          ))}
        </div>
        <h3>Photo gallery</h3>
        <div className="edit-photos">
          {h.photos.map((p: string, i: number) => (
            <div key={i}>
              <img src={p} alt={`Photo ${i + 1}`} />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() =>
                  change(
                    "photos",
                    h.photos.filter((_: string, j: number) => i !== j),
                  )
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <Field label="Add photos (JPEG, PNG, WebP · up to 8 MB each)">
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp"
            disabled={uploading || h.photos.length >= maxPhotos}
            onChange={async (e) => {
              setUploading(true);
              const photos = [...h.photos];
              try {
                for (const f of Array.from(e.target.files || []).slice(
                  0,
                  Math.max(0, maxPhotos - photos.length),
                )) {
                  const fd = new FormData();
                  fd.append("file", f);
                  photos.push((await api("/uploads/photo", "POST", fd)).url);
                }
                change("photos", photos);
              } catch (e) {
                change("photos", photos);
                toast((e as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </Field>
        <p className="muted">
          {h.photos.length} of {maxPhotos} photos used on your {user?.plan}{" "}
          plan.
        </p>
        {!h.id && (
          <>
            <h3>Your first room type</h3>
            <RoomFields room={firstRoom} setRoom={setFirstRoom} />
          </>
        )}
        <button disabled={busy || uploading} className="button full">
          {busy ? "Saving…" : uploading ? "Uploading…" : "Save listing"}
          <Check size={17} />
        </button>
      </form>
    </Modal>
  );
}
function RoomFields({
  room,
  setRoom,
}: {
  room: any;
  setRoom: (r: any) => void;
}) {
  const set = (k: string, v: any) => setRoom({ ...room, [k]: v });
  return (
    <div className="two-col">
      <Field label="Room name">
        <input
          required
          maxLength={80}
          value={room.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field label="Sharing">
        <select
          value={room.sharing}
          onChange={(e) => set("sharing", Number(e.target.value))}
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n === 1
                ? "Single"
                : n === 2
                  ? "Double"
                  : n === 3
                    ? "Triple"
                    : "Four sharing"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Monthly rent per bed (INR)">
        <input
          required
          type="number"
          min={500}
          max={100000}
          value={room.rent}
          onChange={(e) => set("rent", Number(e.target.value))}
        />
      </Field>
      <Field label="Total beds in this room type">
        <input
          required
          type="number"
          min={1}
          max={500}
          value={room.capacity}
          onChange={(e) => set("capacity", Number(e.target.value))}
        />
      </Field>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={!!room.ac}
          onChange={(e) => set("ac", e.target.checked)}
        />
        Air conditioning
      </label>
    </div>
  );
}
function RoomEditor({
  hostel,
  onClose,
  onSave,
}: {
  hostel: Hostel;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const { toast } = useApp();
  const [list, setList] = useState(hostel.rooms),
    [room, setRoom] = useState<any>(null),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={"Rooms · " + hostel.name} onClose={onClose}>
      {list.map((r) => (
        <div className="room-manage" key={r.id}>
          <BedDouble />
          <div>
            <b>{r.name}</b>
            <small>
              {money(r.rent)} / bed / month · {r.capacity} total beds ·{" "}
              {r.ac ? "AC" : "Non-AC"}
            </small>
          </div>
          <button
            className="text-button"
            onClick={() => setRoom({ ...r, ac: !!r.ac })}
          >
            Edit
          </button>
        </div>
      ))}
      <button
        className="text-button"
        onClick={() =>
          setRoom({ name: "", sharing: 2, rent: 7500, capacity: 4, ac: false })
        }
      >
        <Plus size={16} />
        Add room type
      </button>
      {room && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(
                room.id
                  ? "/owner/rooms/" + room.id
                  : "/owner/hostels/" + hostel.id + "/rooms",
                room.id ? "PATCH" : "POST",
                room,
              );
              const d = await api("/owner/hostels");
              setList(d.hostels.find((h: Hostel) => h.id === hostel.id).rooms);
              setRoom(null);
              await onSave();
              toast("Room inventory updated.");
            } catch (e) {
              toast((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <RoomFields room={room} setRoom={setRoom} />
          <button disabled={busy} className="button">
            Save room type
          </button>
        </form>
      )}
    </Modal>
  );
}
function PaymentTable({ payments }: { payments: any[] }) {
  return payments.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>
                <code>{p.reference.slice(0, 18)}</code>
              </td>
              <td>
                {p.kind === "subscription"
                  ? `${p.plan_code || "Advanced"} plan`
                  : p.kind}
              </td>
              <td>{money(p.amount)}</td>
              <td>
                <Badge status={p.status}>{p.status}</Badge>
              </td>
              <td>{dateLabel(p.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="muted">
      Payment activity appears here after a demo checkout.
    </p>
  );
}
export function Admin() {
  const [property, setProperty] = useState("");
  const { toast } = useApp();
  const { data, error, load } = useLoad("/dashboard");
  const [tab, setTab] = useState("listings"),
    [review, setReview] = useState<any>(null),
    [identityReview, setIdentityReview] = useState<any>(null),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false);
  const act = async (path: string, body: any) => {
    try {
      await api(path, "POST", body);
      await load();
      toast("Changes saved.");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="page">
      <PageTitle
        eyebrow="ADMIN WORKSPACE"
        title="A community built on trust."
        subtitle="Review properties, support members and keep every booking on track."
      >
        <a className="button secondary" href="/api/reports/bookings.csv">
          <Download size={17} />
          Export report
        </a>
      </PageTitle>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <>
            <Portfolio property={property} onProperty={setProperty} />
            <WorkQueues stats={data.stats} />
            <div className="stats-grid">
              <div className="stat">
                <span>Basic owners</span>
                <strong>{data.stats.basic_owners}</strong>
                <small>Free plan</small>
              </div>
              <div className="stat">
                <span>Advanced owners</span>
                <strong>{data.stats.advanced_owners}</strong>
                <small>Priority plan</small>
              </div>
              <div className="stat">
                <span>Subscription revenue</span>
                <strong>{money(data.stats.subscription_revenue)}</strong>
                <small>Simulated successful payments</small>
              </div>
            </div>
            <div className="dashboard-shortcuts">
              <Link to="/bookings">
                <CreditCard size={18} />
                Bookings & refunds
                <ArrowUpRight size={16} />
              </Link>
              <Link to="/support">
                <LifeBuoy size={18} />
                Complaints & support
                <ArrowUpRight size={16} />
              </Link>
              <Link to="/notifications">
                <Bell size={18} />
                Notifications
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="tabs">
              {[
                "verifications",
                "listings",
                "users",
                "reviews",
                "payments",
                "audit",
              ].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t === "verifications"
                    ? `Account verification (${data.stats.pending_accounts} pending)`
                    : t === "listings"
                      ? `Listings (${data.stats.pending} pending)`
                      : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {tab === "verifications" && (
              <div className="panel">
                {data.identity_verifications?.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Role</th>
                          <th>Document</th>
                          <th>Status</th>
                          <th>Submitted</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.identity_verifications.map((v: any) => (
                          <tr key={v.id}>
                            <td>
                              <b>{v.user_name}</b>
                              <small>{v.user_email}</small>
                            </td>
                            <td>{v.user_role}</td>
                            <td>{v.document_type.replaceAll("_", " ")}</td>
                            <td>
                              <Badge status={v.status}>{v.status}</Badge>
                            </td>
                            <td>{dateLabel(v.updated_at)}</td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setNote(v.review_note || "");
                                  setIdentityReview(v);
                                }}
                              >
                                {v.status === "pending" ? "Review" : "View"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="No account verifications"
                    body="New user and owner registrations will appear here."
                  />
                )}
              </div>
            )}
            {tab === "listings" && (
              <div className="owner-listings">
                {data.hostels.map((h: Hostel) => (
                  <article className="owner-property" key={h.id}>
                    <img
                      src={h.photos[0] || "/images/room-1.jpg"}
                      alt={h.name}
                    />
                    <div>
                      <Badge status={h.status}>{h.status}</Badge>
                      <h3>{h.name}</h3>
                      <p>
                        {h.city} · Owner: {h.owner_name}
                      </p>
                      <div className="booking-actions">
                        <Link className="text-button" to={"/hostels/" + h.id}>
                          Inspect listing
                          <ArrowUpRight size={14} />
                        </Link>
                        <button
                          className="button secondary small"
                          onClick={() => {
                            setReview(h);
                            setNote("");
                          }}
                        >
                          {h.status === "pending"
                            ? "Review documents"
                            : "View verification"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {tab === "users" && (
              <div className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u: User) => (
                      <tr key={u.id}>
                        <td>
                          <b>{u.name}</b>
                          <small>{u.email}</small>
                        </td>
                        <td>{u.role}</td>
                        <td>{u.role === "owner" ? u.plan : "—"}</td>
                        <td>
                          <Badge status={u.status}>{u.status}</Badge>
                        </td>
                        <td>
                          {u.role !== "admin" &&
                            ["active", "suspended"].includes(u.status) && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  act("/admin/users/" + u.id + "/status", {
                                    status:
                                      u.status === "active"
                                        ? "suspended"
                                        : "active",
                                  })
                                }
                              >
                                {u.status === "active"
                                  ? "Suspend"
                                  : "Reactivate"}
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === "reviews" && (
              <div className="panel">
                {data.reviews.length ? (
                  data.reviews.map((r: any) => (
                    <div className="review" key={r.id}>
                      <Badge status={r.status}>{r.status}</Badge>
                      <h3>
                        {r.hostel_name} · {r.rating}/5
                      </h3>
                      <b>{r.name}</b>
                      <p>{r.body}</p>
                      <button
                        className="text-button"
                        onClick={() =>
                          act("/admin/reviews/" + r.id, {
                            status:
                              r.status === "published" ? "hidden" : "published",
                          })
                        }
                      >
                        {r.status === "published"
                          ? "Hide review"
                          : "Restore review"}
                      </button>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="No reviews to moderate"
                    body="Guest reviews will appear here."
                  />
                )}
              </div>
            )}
            {tab === "payments" && (
              <div className="panel">
                <PaymentTable payments={data.payments} />
                <h3>Recent subscription attempts</h3>
                {data.subscription_attempts.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Owner</th>
                          <th>Plan</th>
                          <th>Method</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.subscription_attempts.map((attempt: any) => (
                          <tr key={attempt.id}>
                            <td>
                              {attempt.owner_name}
                              <small>{attempt.owner_email}</small>
                            </td>
                            <td>{attempt.plan_code}</td>
                            <td>{attempt.method.toUpperCase()}</td>
                            <td>{money(attempt.amount)}</td>
                            <td>
                              <Badge status={attempt.status}>
                                {attempt.status}
                              </Badge>
                            </td>
                            <td>{dateLabel(attempt.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">
                    No interactive subscription attempts yet.
                  </p>
                )}
              </div>
            )}
            {tab === "audit" && (
              <div className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Details</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((a: any) => (
                      <tr key={a.id}>
                        <td>{a.action}</td>
                        <td>{a.target_id.slice(0, 12)}</td>
                        <td>{a.detail || "—"}</td>
                        <td>{dateLabel(a.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.audit.length && <p>No administrative actions yet.</p>}
              </div>
            )}
          </>
        )
      )}
      {identityReview && (
        <Modal
          title={"Verify " + identityReview.user_name}
          onClose={() => setIdentityReview(null)}
        >
          <p>
            Confirm that the document is clear, belongs to the applicant, and
            matches the account name. Never copy identity numbers into notes.
          </p>
          <div className="verification-summary">
            <div>
              <small>Applicant</small>
              <b>{identityReview.user_name}</b>
              <span>{identityReview.user_email}</span>
            </div>
            <div>
              <small>Account type</small>
              <b>{identityReview.user_role}</b>
            </div>
            <div>
              <small>Document type</small>
              <b>{identityReview.document_type.replaceAll("_", " ")}</b>
            </div>
          </div>
          <a
            className="document-link"
            href={`/api/identity-verifications/${identityReview.id}/document`}
            target="_blank"
            rel="noreferrer"
          >
            <FileCheck size={20} />
            Open private identity document
            <Download size={16} />
          </a>
          {identityReview.status !== "pending" ? (
            <div className="info-box">
              <b>Decision: {identityReview.status}</b>
              <p>{identityReview.review_note}</p>
              {identityReview.reviewer_name && (
                <small>Reviewed by {identityReview.reviewer_name}</small>
              )}
            </div>
          ) : (
            <>
              <Field label="Review note (required; do not enter ID numbers)">
                <textarea
                  value={note}
                  maxLength={1000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Record what was checked or explain what must be replaced."
                />
              </Field>
              <div className="dialog-actions">
                {(["rejected", "approved"] as const).map((status) => (
                  <button
                    key={status}
                    disabled={busy || !note.trim()}
                    className={
                      "button " + (status === "rejected" ? "secondary" : "")
                    }
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api(
                          `/admin/identity-verifications/${identityReview.id}/review`,
                          "POST",
                          { status, note },
                        );
                        setIdentityReview(null);
                        setNote("");
                        await load();
                        toast(`Account ${status}.`);
                      } catch (e) {
                        toast((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {status === "approved"
                      ? "Approve account"
                      : "Reject and request replacement"}
                  </button>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
      {review && (
        <Modal title={"Verify " + review.name} onClose={() => setReview(null)}>
          <p>
            Inspect the documents and property details before approving. Only
            approved listings appear in search.
          </p>
          {review.documents.length ? (
            review.documents.map((d: any) => (
              <a
                className="document-link"
                href={"/api/documents/" + d.id}
                key={d.id}
              >
                <FileCheck size={20} />
                {d.name}
                <Download size={16} />
              </a>
            ))
          ) : (
            <div className="info-box">
              No documents uploaded. Approval is blocked until the owner
              supplies documents.
            </div>
          )}
          {review.verification_note && (
            <p>Previous note: {review.verification_note}</p>
          )}
          {review.status === "pending" && (
            <>
              <Field label="Verification note (required)">
                <textarea
                  value={note}
                  maxLength={1000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Record what you checked, or why this needs changes."
                />
              </Field>
              <div className="dialog-actions">
                {["rejected", "approved"].map((status) => (
                  <button
                    key={status}
                    disabled={
                      busy ||
                      !note.trim() ||
                      (status === "approved" && !review.documents.length)
                    }
                    className={
                      "button " + (status === "rejected" ? "secondary" : "")
                    }
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api(
                          "/admin/hostels/" + review.id + "/review",
                          "POST",
                          { status, note },
                        );
                        setReview(null);
                        await load();
                        toast("Listing " + status + ".");
                      } catch (e) {
                        toast((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {status === "approved"
                      ? "Approve & publish"
                      : "Request changes"}
                  </button>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function SubscriptionCheckout({ onClose }: { onClose: () => void }) {
  const { refresh } = useApp();
  const [method, setMethod] = useState("upi");
  const [outcome, setOutcome] = useState("success");
  const [consent, setConsent] = useState(false);
  const [attempt, setAttempt] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (attempt?.status !== "processing") return;
    const timer = setTimeout(async () => {
      try {
        const result = await api(
          `/subscription-attempts/${attempt.id}/complete`,
          "POST",
          {},
        );
        setAttempt(result.attempt);
        setPayment(result.payment);
        if (result.attempt.status === "paid") await refresh();
        if (result.attempt.status !== "processing") setKey(crypto.randomUUID());
      } catch (e) {
        setError((e as Error).message);
      }
    }, 1600);
    return () => clearTimeout(timer);
  }, [attempt?.id, attempt?.status]);
  const processing = attempt?.status === "processing";
  const paid = attempt?.status === "paid";
  async function begin() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/owner/subscription-attempts", "POST", {
        plan: "Advanced",
        method,
        outcome,
        idempotency_key: key,
      });
      setAttempt(result.attempt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={paid ? "Advanced is active" : "Activate Advanced"}
      onClose={processing ? () => {} : onClose}
    >
      <div className="checkout-trust">
        <ShieldCheck size={17} /> Demo subscription payment — no money
        transferred
      </div>
      {paid ? (
        <div className="payment-result success">
          <CheckCircle2 size={52} />
          <h3>Your Advanced plan is active</h3>
          <p>
            Priority discovery, expanded limits and advanced reports are ready.
          </p>
          <strong>{money(999)}</strong>
          {payment && (
            <a
              className="button secondary"
              href={`/api/subscription-payments/${payment.id}/receipt`}
            >
              <Download size={17} /> Download receipt
            </a>
          )}
          <button className="button" onClick={onClose}>
            Return to plans
          </button>
        </div>
      ) : processing ? (
        <div className="payment-result" role="status">
          <LoaderCircle size={44} className="spin" />
          <h3>Confirming your demo payment</h3>
          <p>Please keep this window open while the simulated bank responds.</p>
        </div>
      ) : (
        <>
          <div className="receipt-lines">
            <div>
              <span>Advanced plan</span>
              <b>{money(999)}</b>
            </div>
            <div className="payment-grand-total">
              <span>Amount due now</span>
              <strong>{money(999)}</strong>
            </div>
          </div>
          <div
            className="payment-methods"
            aria-label="Subscription payment method"
          >
            {[
              ["upi", "UPI", Smartphone],
              ["card", "Card", CreditCard],
              ["netbanking", "Net banking", Landmark],
            ].map(([value, label, Icon]: any) => (
              <button
                key={value}
                aria-pressed={method === value}
                className={method === value ? "selected" : ""}
                onClick={() => {
                  setMethod(value);
                  setKey(crypto.randomUUID());
                }}
              >
                <Icon size={20} /> {label}
              </button>
            ))}
          </div>
          <Field label="Demo bank response">
            <select
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setKey(crypto.randomUUID());
              }}
            >
              <option value="success">Approve payment</option>
              <option value="failure">Decline payment to test retry</option>
            </select>
          </Field>
          {attempt?.status === "failed" && (
            <div className="error-box">
              Payment declined. Your Basic plan is unchanged. You can retry.
            </div>
          )}
          <label className="payment-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I understand this is a simulated ₹999 payment with no automatic
              renewal.
            </span>
          </label>
          <button
            className="button full"
            disabled={busy || !consent}
            onClick={begin}
          >
            {busy ? "Connecting…" : `Pay ${money(999)}`}{" "}
            <ShieldCheck size={18} />
          </button>
          <ErrorBox error={error} />
        </>
      )}
    </Modal>
  );
}

export function Plans() {
  const { user, refresh, toast, config } = useApp();
  const listings = useLoad("/owner/hostels");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const propertyCount = listings.data?.hostels.length || 0;
  const photoCount = (listings.data?.hostels || []).reduce(
    (total: number, hostel: any) => total + hostel.photos.length,
    0,
  );
  const features: any = {
    Basic: [
      "Manage 1 property",
      "Upload up to 8 photos per property",
      "Booking, room and availability management",
      "Messages, notifications and portfolio totals",
      "Standard search placement",
    ],
    Advanced: [
      "Manage up to 10 properties",
      "Upload up to 200 photos per property",
      "Priority placement in search results",
      "Property-level revenue and occupancy analytics",
      "Booking CSV reports, discounts and special offers",
    ],
  };
  return (
    <div className="page">
      <PageTitle
        eyebrow="ROOM TO GROW"
        title="Two clear plans. One complete workflow."
        subtitle="Limits are enforced by the same rules used by search, reports and property management."
      />
      <div className="info-box">
        Current usage: <b>{propertyCount} properties</b> and{" "}
        <b>{photoCount} photos</b>. Existing data is preserved if you move to
        Basic.
      </div>
      <ErrorBox error={listings.error} />
      <div className="plans">
        {(config.plans || []).map((plan: any) => (
          <article
            className={plan.code === "Advanced" ? "featured" : ""}
            key={plan.code}
          >
            {plan.code === "Advanced" && <Badge>PRIORITY PLAN</Badge>}
            <h2>{plan.name}</h2>
            <p>{plan.description}</p>
            <strong>
              {money(plan.price)}
              <small> / month</small>
            </strong>
            <ul>
              {features[plan.code].map((item: string) => (
                <li key={item}>
                  <Check size={17} />
                  {item}
                </li>
              ))}
            </ul>
            <button
              className={`button full ${plan.code === "Basic" ? "secondary" : ""}`}
              disabled={user?.plan === plan.code || !config.demo}
              onClick={() => setSelected(plan.code)}
            >
              {user?.plan === plan.code
                ? "Your current plan"
                : plan.code === "Advanced"
                  ? "Upgrade to Advanced"
                  : "Move to Basic"}
            </button>
            <small>Simulated plan · no recurring charge</small>
          </article>
        ))}
      </div>
      {selected === "Advanced" && (
        <SubscriptionCheckout onClose={() => setSelected("")} />
      )}
      {selected === "Basic" && (
        <Modal title="Move to Basic?" onClose={() => setSelected("")}>
          <p>
            Your properties and bookings remain intact. Basic limits apply to
            new properties, new photos, discounts and report exports.
          </p>
          {propertyCount > 1 && (
            <div className="info-box">
              Your {propertyCount} properties remain active, but you cannot add
              another property while Basic is active.
            </div>
          )}
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/owner/subscription", "POST", { plan: "Basic" });
                await refresh();
                await listings.load();
                setSelected("");
                toast("Basic plan activated. Existing data was preserved.");
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Updating…" : "Confirm Basic plan"}
          </button>
        </Modal>
      )}
    </div>
  );
}
