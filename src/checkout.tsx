import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Landmark,
  LoaderCircle,
  Smartphone,
  ShieldCheck,
  Download,
} from "lucide-react";
import { api, money, dateLabel } from "./api";
import { Badge, ErrorBox, Field, Modal } from "./shared";

export function PaymentBreakdown({ booking: b }: { booking: any }) {
  return (
    <div className="receipt-lines">
      <div>
        <span>
          {b.flow_version === 2 ? "First month rent" : "Rent"}{" "}
          {b.quantity > 1 ? `· ${b.quantity} beds` : ""}
        </span>
        <b>{money(b.rent)}</b>
      </div>
      {b.discount_amount > 0 && (
        <div>
          <span>Discount included in rent</span>
          <span>−{money(b.discount_amount)}</span>
        </div>
      )}
      <div>
        <span>Refundable deposit</span>
        <b>{money(b.deposit)}</b>
      </div>
      {b.food_charge > 0 && (
        <div>
          <span>First month food plan</span>
          <b>{money(b.food_charge)}</b>
        </div>
      )}
      {b.service_charge > 0 && (
        <div>
          <span>First month services</span>
          <b>{money(b.service_charge)}</b>
        </div>
      )}
      {b.tax_amount > 0 && (
        <div>
          <span>Tax</span>
          <b>{money(b.tax_amount)}</b>
        </div>
      )}
      <div className="payment-grand-total">
        <span>{b.payment_status ? "Amount paid" : "Amount due now"}</span>
        <strong>{money(b.total)}</strong>
      </div>
      {b.flow_version === 2 && (
        <p className="muted">
          Later monthly charges:{" "}
          {money(
            b.monthly_rent + b.food_charge + b.service_charge + b.tax_amount,
          )}{" "}
          for the selected beds. Deposit is charged once. Later months are paid
          separately; no automatic debit.
        </p>
      )}
    </div>
  );
}
export function Checkout({
  booking: b,
  onClose,
  onUpdated,
}: {
  booking: any;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [method, setMethod] = useState("upi"),
    [outcome, setOutcome] = useState("success"),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [time, setTime] = useState(Date.now()),
    [consent, setConsent] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let alive = true;
    api("/bookings/" + b.id)
      .then((d) => {
        if (!alive) return;
        const running = d.attempts.find((a: any) => a.status === "processing");
        if (running) setAttempt(running);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    const clock = setInterval(() => setTime(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(clock);
    };
  }, [b.id]);
  useEffect(() => {
    if (attempt?.status !== "processing") return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const d = await api(
          "/payment-attempts/" + attempt.id + "/complete",
          "POST",
          {},
        );
        if (!alive) return;
        setAttempt(d.attempt);
        if (d.attempt.status !== "processing") {
          setKey(crypto.randomUUID());
          await onUpdated();
        }
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setAttempt((a: any) => ({ ...a, connectionError: true }));
        }
      }
    }, 1500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [attempt]);
  const processing = attempt?.status === "processing",
    paid = b.payment_status === "paid" || attempt?.status === "paid";
  const expired = b.status === "expired" || Date.parse(b.expires_at) <= time;
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(b.expires_at) - time) / 60000),
  );
  async function pay() {
    if (busy || processing) return;
    setBusy(true);
    setError("");
    try {
      const d = await api(`/bookings/${b.id}/payment-attempts`, "POST", {
        method,
        outcome,
        idempotency_key: key,
      });
      setAttempt(d.attempt);
    } catch (e) {
      setError((e as Error).message);
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={paid ? "Payment received" : "Complete your booking"}
      onClose={processing ? () => {} : onClose}
    >
      <div className="checkout-trust">
        <ShieldCheck size={17} />
        <span>Demo payment — no money transferred</span>
      </div>
      {paid ? (
        <div className="payment-result success">
          <CheckCircle2 size={52} />
          <h3>Your payment is successful</h3>
          <p>
            {b.flow_version === 2
              ? "Your stay is confirmed. The owner has been notified."
              : "Your payment is recorded and awaits owner approval."}
          </p>
          <strong>{money(b.total)}</strong>
          <a
            className="button secondary"
            href={`/api/bookings/${b.id}/receipt`}
          >
            <Download size={17} />
            Download receipt
          </a>
          <button className="button" onClick={onClose}>
            Back to bookings
          </button>
        </div>
      ) : (
        <>
          <div className="checkout-property">
            <img src={b.photos[0]} alt="" />
            <div>
              <h3>{b.hostel_name}</h3>
              <p>
                {b.room_name} · {b.quantity} bed(s)
              </p>
              <small>
                {dateLabel(b.start_date)} to {dateLabel(b.end_date)}
              </small>
              <p>
                {b.guest_name} · {b.guest_email}
              </p>
            </div>
          </div>
          <PaymentBreakdown booking={b} />
          {processing ? (
            <div className="payment-result" role="status">
              <LoaderCircle size={44} className="spin" />
              <h3>Confirming your payment</h3>
              <p>
                Your simulated {attempt.method} payment is being processed.
                Please keep this window open.
              </p>
              {attempt.connectionError && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setError("");
                    setAttempt({ ...attempt, connectionError: false });
                  }}
                >
                  Check payment status
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="payment-methods" aria-label="Payment method">
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
                    <Icon size={20} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="sample-payment-instrument">
                {method === "upi" ? (
                  <>
                    <Smartphone />
                    <div>
                      <b>Hostel Hub test UPI</b>
                      <p>resident@demo-bank · simulated approval</p>
                    </div>
                  </>
                ) : method === "card" ? (
                  <>
                    <CreditCard />
                    <div>
                      <b>Demo debit card</b>
                      <p>•••• •••• •••• 4242 · sample card</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Landmark />
                    <div>
                      <b>Demo Bank</b>
                      <p>Test savings account · •••• 0123</p>
                    </div>
                  </>
                )}
              </div>
              <p className="muted">
                Sample payment details are supplied for you. No bank login, card
                number or UPI PIN is needed.
              </p>
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
                  Payment declined. No charge was recorded. Choose another
                  method or retry before the deadline.
                </div>
              )}
              {expired || attempt?.status === "expired" ? (
                <div className="info-box">
                  The payment window has closed or the booking was cancelled. No
                  payment can be taken.
                </div>
              ) : (
                <p className="hold-countdown">
                  Approved by the owner · {remaining} minutes left to pay
                </p>
              )}
              <label className="payment-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I have reviewed the amount and cancellation terms: a full
                  refund before move-in; deposit only on or after move-in.
                </span>
              </label>
              <button
                className="button full"
                disabled={
                  busy ||
                  expired ||
                  !consent ||
                  !b.allowed_actions.includes("pay")
                }
                onClick={pay}
              >
                {busy ? "Connecting…" : `Pay ${money(b.total)}`}
                <ShieldCheck size={18} />
              </button>
            </>
          )}
          <ErrorBox error={error} />
        </>
      )}
    </Modal>
  );
}
