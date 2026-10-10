import { randomUUID } from "node:crypto";

export const bookingStatus = (booking, instant = new Date()) =>
  (booking.status === "awaiting_payment" ||
    (booking.flow_version === 2 && booking.status === "pending_owner")) &&
  Date.parse(booking.expires_at) <= instant.getTime()
    ? "expired"
    : booking.status;

// Existing reservations use calendar dates in UTC. Keep policy and availability consistent.
export function cancellationQuote(booking, instant = new Date()) {
  const today = instant.toISOString().slice(0, 10);
  if (
    booking.status === "awaiting_payment" ||
    (booking.flow_version === 2 && booking.status === "pending_owner")
  )
    return {
      amount: 0,
      explanation:
        "No payment was received. Cancelling releases your reserved bed.",
    };
  if (booking.status === "pending_owner" || booking.start_date > today)
    return {
      amount: booking.total,
      explanation:
        "A full refund is available before the move-in date or while awaiting owner approval.",
    };
  return {
    amount: booking.deposit,
    explanation:
      "On or after the move-in date, the deposit is refundable. Rent is retained.",
  };
}

export function bookingPermissions(
  booking,
  user,
  { demo = true, instant = new Date() } = {},
) {
  const status = bookingStatus(booking, instant);
  const today = instant.toISOString().slice(0, 10);
  const actions = [];
  if (user.role === "user" && booking.user_id === user.id) {
    if (status === "awaiting_payment" && demo) actions.push("pay");
    if (["awaiting_payment", "pending_owner", "confirmed"].includes(status))
      actions.push("cancel");
    if (
      ["confirmed", "completed"].includes(status) &&
      booking.start_date <= today &&
      !booking.review_id
    )
      actions.push("review");
  }
  if (user.role === "owner" && booking.owner_id === user.id) {
    if (status === "pending_owner") {
      if (
        booking.end_date > today &&
        (booking.flow_version !== 2 || booking.start_date >= today)
      )
        actions.push("approve");
      actions.push("reject");
    }
    if (status === "confirmed" && booking.end_date <= today)
      actions.push("complete");
  }
  if (
    user.role === "admin" &&
    status === "refund_pending" &&
    demo &&
    booking.payment_provider === "demo"
  )
    actions.push("refund");
  return actions;
}

export async function recordBookingEvent(
  db,
  bookingId,
  actor,
  event,
  status,
  note = "",
) {
  await db.run(
    "INSERT INTO booking_events (id,booking_id,actor_id,actor_name,actor_role,event,status,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      randomUUID(),
      bookingId,
      actor.id,
      actor.name,
      actor.role,
      event,
      status,
      note,
      new Date().toISOString(),
    ],
  );
}

export async function bookingRows(db, user, { demo = true, bookingId } = {}) {
  let where =
    user.role === "admin"
      ? "1=1"
      : user.role === "owner"
        ? "h.owner_id=?"
        : "b.user_id=?";
  const params = user.role === "admin" ? [] : [user.id];
  if (bookingId) {
    where += " AND b.id=?";
    params.push(bookingId);
  }
  const rows = await db.all(
    `SELECT b.*,h.name AS hostel_name,h.photos,h.city,h.owner_id,r.name AS room_name,u.name AS guest_name,u.email AS guest_email,p.status AS payment_status,p.provider AS payment_provider,p.reference AS payment_reference,p.created_at AS paid_at,p.id AS payment_id,p.method AS payment_method,p.refunded_at,v.id AS review_id FROM bookings b JOIN hostels h ON h.id=b.hostel_id JOIN rooms r ON r.id=b.room_id JOIN users u ON u.id=b.user_id LEFT JOIN payments p ON p.booking_id=b.id LEFT JOIN reviews v ON v.booking_id=b.id WHERE ${where} ORDER BY b.created_at DESC,b.id`,
    params,
  );
  const instant = new Date();
  return rows.map((b) => ({
    ...b,
    photos: JSON.parse(b.photos),
    status: bookingStatus(b, instant),
    allowed_actions: bookingPermissions(b, user, { demo, instant }),
    cancellation: ["awaiting_payment", "pending_owner", "confirmed"].includes(
      bookingStatus(b, instant),
    )
      ? cancellationQuote(b, instant)
      : null,
  }));
}
