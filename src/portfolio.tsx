import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, ArrowUpRight } from "lucide-react";
import { api, money, dateLabel } from "./api";
import {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  useLoad,
  useApp,
} from "./shared";

export function Portfolio({
  property,
  onProperty,
}: {
  property: string;
  onProperty: (id: string) => void;
}) {
  const { user } = useApp();
  const { data, error } = useLoad(
    "/portfolio" +
      (property ? "?hostel_id=" + encodeURIComponent(property) : ""),
  );
  const [tab, setTab] = useState("properties");
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const s = data.stats;
  const lists: any = {
    residents: data.residents,
    arrivals: data.arrivals,
    departures: data.departures,
    requests: data.requests,
    awaiting_payment: data.awaiting_payment,
  };
  return (
    <section className="portfolio-workspace">
      <div className="portfolio-toolbar">
        <div>
          <span className="eyebrow">YOUR PORTFOLIO</span>
          <h2>
            {property
              ? data.properties.find((p: any) => p.id === property)?.name
              : "Every property, one overview"}
          </h2>
        </div>
        <label>
          Property
          <select
            aria-label="Portfolio property"
            value={property}
            onChange={(e) => onProperty(e.target.value)}
          >
            <option value="">All properties</option>
            {data.properties.map((h: any) => (
              <option key={h.id} value={h.id}>
                {h.name} · {h.city}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="stats-grid">
        {[
          [
            "Occupied beds",
            `${s.occupied} / ${s.beds}`,
            "Currently checked in",
          ],
          ["Requests to review", s.requests, "Owner decision needed"],
          [
            "Awaiting payment",
            s.awaiting_payment,
            "Approved, not yet confirmed",
          ],
          [
            "Net collections",
            money(s.net),
            `${money(s.gross)} gross · ${money(s.refunds)} refunded`,
          ],
        ].map(([label, value, note]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="work-queue-links">
        <Link
          to={`/bookings?queue=attention${property ? "&property=" + property : ""}`}
        >
          <b>Open action queue</b>
          <span>
            {s.requests} requests · {money(s.pending_refunds)} pending refunds
          </span>
          <ArrowUpRight size={18} />
        </Link>
        <Link to="/payments">
          <b>Payment ledger & receipts</b>
          <span>Successful payments, methods and refunds</span>
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="tabs">
        {[
          ["properties", "Properties"],
          ["residents", "Residents"],
          ["arrivals", "Move-ins · 7 days"],
          ["departures", "Move-outs · 7 days"],
          ["requests", "Requests"],
          ["awaiting_payment", "Awaiting payment"],
          ["reviews", "Reviews"],
          ["messages", "Messages"],
          ...(user?.role === "admin" ? [["imports", "CSV imports"]] : []),
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "properties" && !data.advanced && (
        <div className="info-box">
          Property-by-property revenue and occupancy analytics are available on
          Advanced. Your booking queues and portfolio totals remain available.
          <Link className="text-button" to="/owner/plans">
            Compare plans <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      {tab === "properties" && data.advanced && (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th>Publication</th>
                <th>Occupied / beds</th>
                <th>Requests</th>
                <th>Gross collections</th>
                <th>Refunds</th>
                <th>Net collections</th>
              </tr>
            </thead>
            <tbody>
              {data.performance.map((h: any) => (
                <tr key={h.id}>
                  <td>
                    <Link to={"/hostels/" + h.id}>{h.name}</Link>
                    <small>{h.city}</small>
                  </td>
                  <td>
                    <Badge status={h.status}>{h.status}</Badge>
                  </td>
                  <td>
                    {h.occupied} / {h.beds}
                  </td>
                  <td>{h.requests}</td>
                  <td>{money(h.gross)}</td>
                  <td>{money(h.refunds)}</td>
                  <td>{money(h.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lists[tab] && (
        <div className="panel table-wrap">
          {lists[tab].length ? (
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Property / room</th>
                  <th>Beds</th>
                  <th>Move-in</th>
                  <th>Move-out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lists[tab].map((b: any) => (
                  <tr key={b.id}>
                    <td>
                      {b.guest_name}
                      <small>{b.guest_email}</small>
                    </td>
                    <td>
                      {b.hostel_name}
                      <small>{b.room_name}</small>
                    </td>
                    <td>{b.quantity}</td>
                    <td>{dateLabel(b.start_date)}</td>
                    <td>{dateLabel(b.end_date)}</td>
                    <td>
                      <Badge status={b.status}>
                        {b.status.replaceAll("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No bookings in this view.</p>
          )}
        </div>
      )}
      {tab === "reviews" && (
        <div className="panel">
          {data.reviews.length ? (
            data.reviews.map((r: any) => (
              <article className="review" key={r.id}>
                <Badge status={r.status}>{r.status}</Badge>
                <h3>
                  {r.hostel_name} · {r.rating}/5
                </h3>
                <b>{r.guest_name}</b>
                <p>{r.body}</p>
              </article>
            ))
          ) : (
            <p>No reviews yet.</p>
          )}
        </div>
      )}
      {tab === "messages" && (
        <div className="panel">
          {data.messages.map((m: any) => (
            <article className="review" key={m.id}>
              <b>
                {m.sender_name} · {m.hostel_name}
              </b>
              <p>{m.body}</p>
              <small>{dateLabel(m.created_at)}</small>
            </article>
          ))}
          <Link className="text-button" to="/messages">
            Open conversations <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      {tab === "imports" && (
        <div className="panel">
          {data.imports.map((i: any) => (
            <article className="review" key={i.id}>
              <Badge status={i.status}>{i.status}</Badge>
              <b> {dateLabel(i.created_at)}</b>
              <p>
                {i.summary.error ||
                  `${i.summary.inserted} inserted · ${i.summary.updated} updated · ${i.summary.skipped} preserved or unchanged`}
              </p>
              <small>{i.source}</small>
            </article>
          ))}
          <p className="muted">
            Edit the CSV source files and run the documented validation and
            import commands to apply changes.
          </p>
        </div>
      )}
    </section>
  );
}
export function Payments() {
  const { data, error } = useLoad("/payments");
  const [property, setProperty] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("");
  const payments = (data?.payments || []).filter(
    (p: any) =>
      (!property || p.hostel_id === property) &&
      (!status || p.status === status) &&
      `${p.reference} ${p.guest_name} ${p.hostel_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const properties = [
    ...new Map(
      (data?.payments || [])
        .filter((p: any) => p.hostel_id)
        .map((p: any) => [p.hostel_id, p.hostel_name]),
    ).entries(),
  ];
  return (
    <div className="page">
      <PageTitle
        eyebrow="PAYMENTS & RECEIPTS"
        title="Every payment, accounted for."
        subtitle="Demo payment records, methods, receipts and processed refunds."
      />
      <ErrorBox error={error} />
      <div className="booking-filterbar">
        <input
          aria-label="Search payments"
          placeholder="Reference, guest or property"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Payment property"
          value={property}
          onChange={(e) => setProperty(e.target.value)}
        >
          <option value="">All properties</option>
          {properties.map(([id, name]: any) => (
            <option value={id} key={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Payment status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>
      {!data && !error ? (
        <Loading />
      ) : payments.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Payment</th>
                <th>Guest / property</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Refund</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <code>{p.reference}</code>
                    <small>{dateLabel(p.created_at)}</small>
                  </td>
                  <td>
                    {p.guest_name}
                    <small>{p.hostel_name || "Subscription"}</small>
                  </td>
                  <td>{p.method?.toUpperCase()}</td>
                  <td>{money(p.amount)}</td>
                  <td>
                    {p.status === "refunded" ? money(p.refund_amount) : "—"}
                  </td>
                  <td>
                    <Badge status={p.status}>{p.status}</Badge>
                  </td>
                  <td>
                    {(p.booking_id || p.kind === "subscription") && (
                      <a
                        className="text-button"
                        href={
                          p.booking_id
                            ? `/api/bookings/${p.booking_id}/receipt`
                            : `/api/subscription-payments/${p.id}/receipt`
                        }
                      >
                        <Download size={15} />
                        Receipt
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="No payments in this view"
          body="Payment records will appear after checkout."
        />
      )}
    </div>
  );
}
