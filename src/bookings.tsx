import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  CreditCard,
  Download,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api, money, dateLabel } from "./api";
import { Checkout, PaymentBreakdown } from "./checkout";
import {
  Badge,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageTitle,
  useApp,
} from "./shared";

type Action =
  "pay" | "approve" | "reject" | "cancel" | "complete" | "refund" | "review";
type Booking = {
  flow_version: number;
  quantity: number;
  food_charge: number;
  service_charge: number;
  tax_amount: number;
  monthly_rent: number;
  discount_amount: number;
  guest_note: string;
  payment_id: string | null;
  approved_at: string;
  id: string;
  hostel_id: string;
  hostel_name: string;
  room_name: string;
  city: string;
  guest_name: string;
  guest_email: string;
  photos: string[];
  start_date: string;
  end_date: string;
  status: string;
  rent: number;
  deposit: number;
  total: number;
  refund_amount: number;
  expires_at: string;
  created_at: string;
  payment_status: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  review_id: string | null;
  allowed_actions: Action[];
  cancellation: { amount: number; explanation: string } | null;
};
type BookingEvent = {
  id: string;
  actor_name: string;
  actor_role: string;
  event: string;
  status: string;
  note: string;
  created_at: string;
};
type Detail = { booking: Booking; events: BookingEvent[]; server_time: string };
const eventLabels: Record<string, string> = {
  reserved: "Bed reserved",
  payment_failed: "Payment attempt failed",
  payment_received: "Demo payment received",
  approve: "Owner approved the request",
  payment_started: "Payment processing",
  payment_expired: "Payment window closed",
  reject: "Owner declined the request",
  cancel: "Guest cancelled the booking",
  complete: "Stay completed",
  refund: "Demo refund processed",
};
const actionLabels: Record<Action, string> = {
  pay: "Pay now",
  approve: "Approve",
  reject: "Reject request",
  cancel: "Cancel booking",
  complete: "Complete stay",
  refund: "Process demo refund",
  review: "Write a review",
};
const statusNames = [
  "awaiting_payment",
  "pending_owner",
  "confirmed",
  "refund_pending",
  "refunded",
  "completed",
  "cancelled",
  "expired",
  "rejected",
];
const human = (s: string) => s.replaceAll("_", " ");
const moment = (s: string) =>
  new Date(s).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const activeStates = ["awaiting_payment", "pending_owner", "confirmed"];
const remaining = (b: Booking, time: number) =>
  Math.max(0, Math.ceil((Date.parse(b.expires_at) - time) / 1000));
const countdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function Bookings() {
  const { user, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState("");
  const [time, setTime] = useState(Date.now());
  const offset = useRef(0),
    sequence = useRef(0),
    mounted = useRef(true);
  const [query, setQuery] = useState(""),
    [property, setProperty] = useState(params.get("property") || "");
  const [status, setStatus] = useState(""),
    [sort, setSort] = useState("newest");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequest = useRef(0);
  const [decision, setDecision] = useState<{
    booking: Booking;
    action: Action;
  } | null>(null);
  const [reason, setReason] = useState(""),
    [decisionError, setDecisionError] = useState("");
  const [busy, setBusy] = useState(false),
    [paymentError, setPaymentError] = useState("");
  const [review, setReview] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5),
    [body, setBody] = useState("");
  const tab = params.get("queue") || "all";
  const paymentId = params.get("pay");
  const management = user?.role !== "user";

  async function load() {
    const request = ++sequence.current;
    setRefreshing(true);
    try {
      const result = await api("/bookings");
      if (!mounted.current || request !== sequence.current) return;
      offset.current = Date.parse(result.server_time) - Date.now();
      setTime(Date.now() + offset.current);
      setRows(result.bookings);
      setError("");
      setUpdated(result.server_time);
    } catch (e) {
      if (mounted.current && request === sequence.current)
        setError((e as Error).message);
    } finally {
      if (mounted.current && request === sequence.current) setRefreshing(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    const clock = setInterval(() => setTime(Date.now() + offset.current), 1000);
    const focus = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", focus);
    return () => {
      mounted.current = false;
      ++sequence.current;
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);

  const bookings = (rows || []).map((b) =>
    (b.status === "awaiting_payment" ||
      (b.flow_version === 2 && b.status === "pending_owner")) &&
    remaining(b, time) === 0
      ? {
          ...b,
          status: "expired",
          allowed_actions: [] as Action[],
          cancellation: null,
        }
      : b,
  );
  const payment = bookings.find((b) => b.id === paymentId);
  const isAttention = (b: Booking) =>
    user?.role === "owner"
      ? b.allowed_actions.some(
          (a) => a === "approve" || a === "reject" || a === "complete",
        )
      : user?.role === "admin"
        ? b.status === "refund_pending"
        : b.status === "awaiting_payment";
  const counts: Record<string, number> = {
    all: bookings.length,
    attention: bookings.filter(isAttention).length,
    active: bookings.filter((b) => activeStates.includes(b.status)).length,
    refunds: bookings.filter((b) => b.status === "refund_pending").length,
    past: bookings.filter(
      (b) => !activeStates.includes(b.status) && b.status !== "refund_pending",
    ).length,
  };
  const properties = [
    ...new Map(bookings.map((b) => [b.hostel_id, b.hostel_name])).entries(),
  ];
  const visible = bookings
    .filter(
      (b) =>
        (tab === "all" ||
          (tab === "attention"
            ? isAttention(b)
            : tab === "active"
              ? activeStates.includes(b.status)
              : tab === "refunds"
                ? b.status === "refund_pending"
                : !activeStates.includes(b.status) &&
                  b.status !== "refund_pending")) &&
        (!property || b.hostel_id === property) &&
        (!status || b.status === status) &&
        `${b.id} ${b.hostel_name} ${b.guest_name} ${b.guest_email}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "move-in"
        ? a.start_date.localeCompare(b.start_date)
        : sort === "oldest"
          ? a.created_at.localeCompare(b.created_at)
          : b.created_at.localeCompare(a.created_at),
    );
  const changeParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };
  const closePayment = () => {
    changeParam("pay", "");
    setPaymentError("");
  };
  async function inspect(b: Booking) {
    const request = ++detailRequest.current;
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await api("/bookings/" + b.id);
      if (request === detailRequest.current) setDetail(d);
    } catch (e) {
      if (request === detailRequest.current) toast((e as Error).message);
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }
  async function choose(b: Booking, action: Action) {
    setDetail(null);
    if (action === "pay") {
      setPaymentError("");
      changeParam("pay", b.id);
      return;
    }
    if (action === "review") {
      setReview(b);
      setRating(5);
      setBody("");
      setDecisionError("");
      return;
    }
    // Fetch a fresh quote before asking for a decision, not a cached row from a queue.
    setBusy(true);
    setDecisionError("");
    try {
      const d: Detail = await api("/bookings/" + b.id);
      if (!d.booking.allowed_actions.includes(action)) {
        await load();
        toast(
          "This action is no longer available. The booking list has been refreshed.",
        );
        return;
      }
      setDetail(null);
      setDecision({ booking: d.booking, action });
      setReason("");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const refundFor = (b: Booking, action: Action) =>
    action === "cancel"
      ? b.cancellation?.amount || 0
      : action === "reject"
        ? b.flow_version === 2
          ? 0
          : b.total
        : b.refund_amount;
  async function act() {
    if (!decision || busy) return;
    setBusy(true);
    setDecisionError("");
    const { booking, action } = decision;
    try {
      await api(`/bookings/${booking.id}/action`, "POST", {
        action,
        reason,
        expected_status: booking.status,
        ...(["cancel", "reject", "refund"].includes(action)
          ? { expected_refund_amount: refundFor(booking, action) }
          : {}),
      });
      setDecision(null);
      await load();
      toast(
        action === "refund"
          ? "Demo refund processed. The guest has been notified."
          : "Booking updated. Everyone involved has been notified.",
      );
    } catch (e) {
      setDecisionError((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }
  const renderActions = (b: Booking) => (
    <div className="booking-actions">
      {b.allowed_actions.map((a) => (
        <button
          key={a}
          disabled={busy}
          className={
            a === "cancel"
              ? "text-button danger"
              : a === "review" || a === "reject"
                ? "button secondary small"
                : "button small"
          }
          onClick={() => choose(b, a)}
        >
          {actionLabels[a]}
        </button>
      ))}
      {b.review_id && (
        <span className="reviewed-note">
          <ShieldCheck size={14} />
          Review submitted
        </span>
      )}
    </div>
  );

  return (
    <div className="page booking-workspace">
      <PageTitle
        eyebrow={management ? "RESERVATIONS DESK" : "YOUR JOURNEY"}
        title={management ? "Booking management." : "Your next chapters."}
        subtitle={
          management
            ? "See what needs attention, review each decision and keep guests informed."
            : "Your reservations, payment updates and stay history, all in one place."
        }
      >
        {management && (
          <a className="button secondary" href="/api/reports/bookings.csv">
            <Download size={16} />
            Export bookings
          </a>
        )}
      </PageTitle>
      <div className="booking-overview">
        <button
          onClick={() => {
            changeParam("queue", "attention");
            setStatus("");
          }}
        >
          <span>
            {user?.role === "owner"
              ? "Needs your decision"
              : user?.role === "admin"
                ? "Refunds to process"
                : "Awaiting your payment"}
          </span>
          <strong>{counts.attention}</strong>
          <small>
            Open your action queue <ArrowRight size={14} />
          </small>
        </button>
        <button
          onClick={() => {
            changeParam("queue", "active");
            setStatus("");
          }}
        >
          <span>Upcoming & active</span>
          <strong>{counts.active}</strong>
          <small>Reservations still in progress</small>
        </button>
        <button
          onClick={() => {
            changeParam("queue", "refunds");
            setStatus("");
          }}
        >
          <span>Refunds awaiting processing</span>
          <strong>
            {money(
              bookings
                .filter((b) => b.status === "refund_pending")
                .reduce((n, b) => n + b.refund_amount, 0),
            )}
          </strong>
          <small>
            {counts.refunds} request{counts.refunds === 1 ? "" : "s"} · demo
            payments
          </small>
        </button>
      </div>
      <div className="tabs" aria-label="Booking queues">
        {[
          ["all", "All bookings"],
          ["attention", "Needs attention"],
          ["active", "Upcoming & active"],
          ["refunds", "Refund queue"],
          ["past", "Past & cancelled"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => changeParam("queue", key)}
          >
            {label} <span className="queue-count">{counts[key]}</span>
          </button>
        ))}
      </div>
      <div className="booking-filterbar">
        <label className="booking-search">
          <Search size={17} />
          <input
            aria-label="Search bookings"
            placeholder={
              management
                ? "Guest, property or booking ID"
                : "Property or booking ID"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by property"
          value={property}
          onChange={(e) => setProperty(e.target.value)}
        >
          <option value="">All properties</option>
          {properties.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by booking status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {statusNames.map((s) => (
            <option key={s} value={s}>
              {human(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort bookings"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="move-in">Move-in date</option>
        </select>
      </div>
      <div className="booking-update-line">
        <span>
          {visible.length} of {bookings.length} bookings
          {updated
            ? ` · Updated ${new Date(updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </span>
        <button className="text-button" disabled={refreshing} onClick={load}>
          <RefreshCw size={14} className={refreshing ? "spin" : ""} />
          Refresh
        </button>
      </div>
      <ErrorBox error={error} />
      {!rows && !error ? (
        <Loading />
      ) : visible.length ? (
        <div className="booking-list">
          {visible.map((b) => (
            <article className="booking-card" key={b.id}>
              <img
                src={b.photos[0] || "/images/room-1.jpg"}
                alt={b.hostel_name}
              />
              <div className="booking-card-main">
                <div className="card-meta">
                  <Badge status={b.status}>{human(b.status)}</Badge>
                  <small title={b.id}>#{b.id.slice(0, 8)}</small>
                </div>
                <Link to={"/hostels/" + b.hostel_id}>
                  <h3>{b.hostel_name}</h3>
                </Link>
                <p>
                  {b.room_name} · {b.city}
                </p>
                <div className="booking-dates">
                  <CalendarDays size={16} />
                  {dateLabel(b.start_date)}
                  <ArrowRight size={13} />
                  {dateLabel(b.end_date)}
                </div>
                {management && (
                  <small>
                    Guest: {b.guest_name} · {b.guest_email}
                  </small>
                )}
                {b.status === "awaiting_payment" && (
                  <div
                    className={`hold-countdown ${remaining(b, time) < 120 ? "urgent" : ""}`}
                  >
                    <Clock size={14} />
                    Payment hold: {countdown(remaining(b, time))} remaining
                  </div>
                )}
                {b.status === "expired" && (
                  <p className="expired-note">
                    The unpaid hold expired and the bed was released. Start a
                    new reservation to check availability.
                  </p>
                )}
                {renderActions(b)}
                <button className="text-button" onClick={() => inspect(b)}>
                  <History size={14} />
                  Booking details & history
                </button>
              </div>
              <div className="booking-total">
                <small>
                  {b.flow_version === 2
                    ? "First month + deposit"
                    : "Total incl. deposit"}
                </small>
                <strong>{money(b.total)}</strong>
                {["refund_pending", "refunded"].includes(b.status) && (
                  <p>
                    {b.status === "refunded" ? "Refunded" : "Refund due"}:{" "}
                    {money(b.refund_amount)}
                  </p>
                )}
                <small>
                  {b.payment_status
                    ? `${human(b.payment_status)} · ${b.payment_provider}`
                    : "No payment received"}
                </small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            bookings.length
              ? "No bookings match this view"
              : "A new chapter is waiting"
          }
          body={
            bookings.length
              ? "Change your search or filters to see other bookings."
              : "Your reservations will appear here."
          }
        >
          {bookings.length ? (
            <button
              className="button secondary"
              onClick={() => {
                setQuery("");
                setProperty("");
                setStatus("");
                changeParam("queue", "all");
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link className="button" to="/">
              Find your space
            </Link>
          )}
        </Empty>
      )}
      {(detail || detailLoading) && (
        <Modal
          title="Booking details & history"
          onClose={() => {
            ++detailRequest.current;
            setDetail(null);
            setDetailLoading(false);
          }}
        >
          {detailLoading ? (
            <Loading />
          ) : (
            detail && (
              <>
                <Badge status={detail.booking.status}>
                  {human(detail.booking.status)}
                </Badge>
                <h3 className="booking-detail-title">
                  {detail.booking.hostel_name}
                </h3>
                <p>
                  {detail.booking.room_name} ·{" "}
                  {dateLabel(detail.booking.start_date)} to{" "}
                  {dateLabel(detail.booking.end_date)}
                </p>
                <p className="booking-id">Booking ID: {detail.booking.id}</p>
                {management && (
                  <p>
                    Guest: {detail.booking.guest_name} ·{" "}
                    {detail.booking.guest_email}
                  </p>
                )}
                <PaymentBreakdown booking={detail.booking} />
                {detail.booking.guest_note && (
                  <div className="info-box">
                    Guest note: {detail.booking.guest_note}
                  </div>
                )}
                {detail.booking.payment_id && (
                  <a
                    className="button secondary small"
                    href={`/api/bookings/${detail.booking.id}/receipt`}
                  >
                    <Download size={16} />
                    Download receipt
                  </a>
                )}
                <div className="receipt-lines">
                  {detail.booking.payment_reference && (
                    <div>
                      <span>Payment reference</span>
                      <code>{detail.booking.payment_reference}</code>
                    </div>
                  )}
                  {detail.booking.paid_at && (
                    <div>
                      <span>Payment received</span>
                      <span>{moment(detail.booking.paid_at)}</span>
                    </div>
                  )}
                  {["refund_pending", "refunded"].includes(
                    detail.booking.status,
                  ) && (
                    <div>
                      <span>
                        {detail.booking.status === "refunded"
                          ? "Refund processed"
                          : "Refund pending"}
                      </span>
                      <b>{money(detail.booking.refund_amount)}</b>
                    </div>
                  )}
                </div>
                <h3>Booking history</h3>
                <ol className="booking-timeline">
                  <li>
                    <span className="timeline-dot" />
                    <div>
                      <b>Reservation created</b>
                      <small>{moment(detail.booking.created_at)}</small>
                    </div>
                  </li>
                  {detail.events
                    .filter((e) => e.event !== "reserved")
                    .map((e) => (
                      <li key={e.id}>
                        <span className="timeline-dot" />
                        <div>
                          <b>{eventLabels[e.event] || human(e.event)}</b>
                          <small>
                            {moment(e.created_at)} · {e.actor_name} (
                            {e.actor_role})
                          </small>
                          {e.note && <p>{e.note}</p>}
                        </div>
                      </li>
                    ))}
                  {detail.booking.status === "expired" && (
                    <li>
                      <span className="timeline-dot" />
                      <div>
                        <b>Unpaid reservation expired</b>
                        <small>
                          {moment(detail.booking.expires_at)} · Bed released
                          automatically
                        </small>
                      </div>
                    </li>
                  )}
                </ol>
                {!detail.events.some((event) => event.event === "reserved") && (
                  <div className="info-box">
                    This booking predates detailed history tracking. Earlier
                    decision timestamps and notes are not available.
                  </div>
                )}
                {renderActions(detail.booking)}
              </>
            )
          )}
        </Modal>
      )}
      {payment && (
        <Checkout booking={payment} onClose={closePayment} onUpdated={load} />
      )}
      {decision && (
        <Modal
          title={`${decision.action[0].toUpperCase() + decision.action.slice(1)} booking?`}
          onClose={busy ? () => {} : () => setDecision(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act();
            }}
          >
            <h3>{decision.booking.hostel_name}</h3>
            <p>
              {decision.booking.guest_name} ·{" "}
              {dateLabel(decision.booking.start_date)} to{" "}
              {dateLabel(decision.booking.end_date)}
            </p>
            {["cancel", "reject", "refund"].includes(decision.action) ? (
              <div className="refund-preview">
                <span>
                  {decision.action === "refund"
                    ? "Demo refund to process"
                    : "Refund if you continue"}
                </span>
                <strong>
                  {money(refundFor(decision.booking, decision.action))}
                </strong>
                <p>
                  {decision.action === "cancel"
                    ? decision.booking.cancellation?.explanation
                    : decision.action === "reject"
                      ? decision.booking.flow_version === 2
                        ? "No payment has been taken. The guest will receive your reason and the bed will be released."
                        : "The full paid amount will enter the admin refund queue. The guest will receive your reason."
                      : "This is the amount already approved for this cancellation. Processing records one demo refund and notifies the guest."}
                </p>
              </div>
            ) : (
              <div className="info-box">
                {decision.action === "approve"
                  ? decision.booking.flow_version === 2
                    ? "Approve this request and give the guest 24 hours to pay. Their stay is confirmed only after payment."
                    : "Confirm this paid request and notify the guest that their stay is approved."
                  : "Mark this stay complete. The guest can then see it in their stay history."}
              </div>
            )}
            {decision.action === "cancel" || decision.action === "reject" ? (
              <Field
                label={
                  decision.action === "reject"
                    ? "Reason for rejection (required, shared with guest)"
                    : "Reason for cancellation (optional, shared with owner)"
                }
              >
                <textarea
                  required={decision.action === "reject"}
                  minLength={decision.action === "reject" ? 5 : undefined}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    decision.action === "reject"
                      ? "Explain what prevented you from accepting this request."
                      : "Let the owner know why your plans changed."
                  }
                />
              </Field>
            ) : null}
            <ErrorBox error={decisionError} />
            <div className="dialog-actions">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => setDecision(null)}
              >
                Go back
              </button>
              <button
                className="button"
                disabled={
                  busy ||
                  (decision.action === "reject" && reason.trim().length < 5)
                }
              >
                {busy ? "Updating…" : `Confirm ${decision.action}`}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {review && (
        <Modal
          title={"Review " + review.hostel_name}
          onClose={busy ? () => {} : () => setReview(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setDecisionError("");
              try {
                await api("/reviews", "POST", {
                  booking_id: review.id,
                  rating,
                  body,
                });
                setReview(null);
                await load();
                toast("Your review is published.");
              } catch (e) {
                setDecisionError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <ErrorBox error={decisionError} />
            <Field label="Your rating">
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your experience">
              <textarea
                required
                maxLength={2000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <button className="button" disabled={busy}>
              Publish review
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
