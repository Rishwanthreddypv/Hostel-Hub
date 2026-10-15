import { bookingRows, bookingStatus } from "./booking-workflow.js";
import { planFor } from "./plans.js";
export function installPortfolio(app, db, { auth, demo, fail }) {
  app.get("/api/portfolio", auth("owner", "admin"), async (req, res) => {
    const all = await db.all(
      `SELECT id,name,city,status FROM hostels ${req.user.role === "owner" ? "WHERE owner_id=?" : ""} ORDER BY name`,
      req.user.role === "owner" ? [req.user.id] : [],
    );
    const selected =
      typeof req.query.hostel_id === "string" ? req.query.hostel_id : "";
    if (selected && !all.some((h) => h.id === selected))
      fail(404, "Property not found");
    const ids = new Set(
      all.filter((h) => !selected || h.id === selected).map((h) => h.id),
    );
    const bookings = (await bookingRows(db, req.user, { demo })).filter((b) =>
      ids.has(b.hostel_id),
    );
    const today = new Date().toISOString().slice(0, 10),
      week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const rooms = (await db.all("SELECT * FROM rooms")).filter((r) =>
      ids.has(r.hostel_id),
    );
    const payments = (
      await db.all(
        "SELECT p.*,b.hostel_id,b.refund_amount,h.name AS hostel_name,u.name AS guest_name FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN hostels h ON h.id=b.hostel_id JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC",
      )
    ).filter((p) => ids.has(p.hostel_id));
    const residents = bookings.filter(
      (b) =>
        b.status === "confirmed" && b.start_date <= today && b.end_date > today,
    );
    const statsFor = (list) => {
      const relevant = bookings.filter((b) => list.has(b.hostel_id));
      const paid = payments.filter((p) => list.has(p.hostel_id));
      const gross = paid.reduce((s, p) => s + p.amount, 0),
        refunds = paid
          .filter((p) => p.status === "refunded")
          .reduce((s, p) => s + p.refund_amount, 0);
      return {
        beds: rooms
          .filter((r) => list.has(r.hostel_id))
          .reduce((s, r) => s + r.capacity, 0),
        occupied: residents
          .filter((b) => list.has(b.hostel_id))
          .reduce((s, b) => s + b.quantity, 0),
        requests: relevant.filter((b) => b.status === "pending_owner").length,
        awaiting_payment: relevant.filter(
          (b) => b.status === "awaiting_payment",
        ).length,
        gross,
        refunds,
        net: gross - refunds,
        pending_refunds: relevant
          .filter((b) => b.status === "refund_pending")
          .reduce((s, b) => s + b.refund_amount, 0),
      };
    };
    const reviews = (
      await db.all(
        "SELECT r.*,h.name AS hostel_name,u.name AS guest_name FROM reviews r JOIN hostels h ON h.id=r.hostel_id JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC",
      )
    ).filter((r) => ids.has(r.hostel_id));
    const messages = (
      await db.all(
        "SELECT m.*,h.name AS hostel_name,u.name AS sender_name FROM messages m JOIN hostels h ON h.id=m.hostel_id JOIN users u ON u.id=m.sender_id ORDER BY m.created_at DESC",
      )
    ).filter((m) => ids.has(m.hostel_id));
    const advanced =
      req.user.role === "admin" || planFor(req.user.plan).advancedAnalytics;
    res.json({
      advanced,
      properties: all,
      stats: statsFor(ids),
      performance: advanced
        ? all
            .filter((h) => ids.has(h.id))
            .map((h) => ({ ...h, ...statsFor(new Set([h.id])) }))
        : [],
      residents,
      arrivals: bookings.filter(
        (b) =>
          b.status === "confirmed" &&
          b.start_date > today &&
          b.start_date <= week,
      ),
      departures: residents.filter((b) => b.end_date <= week),
      requests: bookings.filter((b) => b.status === "pending_owner"),
      awaiting_payment: bookings.filter((b) => b.status === "awaiting_payment"),
      payments,
      reviews: reviews.slice(0, 8),
      messages: messages.slice(0, 8),
      imports:
        req.user.role === "admin"
          ? (
              await db.all(
                "SELECT * FROM seed_imports ORDER BY created_at DESC LIMIT 10",
              )
            ).map((r) => ({ ...r, summary: JSON.parse(r.summary) }))
          : [],
    });
  });
}
