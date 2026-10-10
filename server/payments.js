import { randomUUID } from "node:crypto";
import { z } from "zod";
import { bookingStatus, recordBookingEvent } from "./booking-workflow.js";

export function installPayments(app, db, { auth, demo, fail, notify }) {
  const owned = async (tx, id, user) => {
    const b = await tx.get("SELECT * FROM bookings WHERE id=?" + tx.lock, [id]);
    if (!b || b.user_id !== user.id) fail(404, "Booking not found");
    return b;
  };
  app.post(
    "/api/bookings/:id/payment-attempts",
    auth("user"),
    async (req, res) => {
      if (!demo) fail(503, "Demo payments are disabled");
      const d = z
        .object({
          method: z.enum(["upi", "card", "netbanking"]),
          outcome: z.enum(["success", "failure"]),
          idempotency_key: z.string().uuid(),
        })
        .strict()
        .parse(req.body);
      const attempt = await db.transaction(async (tx) => {
        const b = await owned(tx, req.params.id, req.user);
        const prior = await tx.get(
          "SELECT * FROM payment_attempts WHERE idempotency_key=?",
          [d.idempotency_key],
        );
        if (prior) {
          if (
            prior.booking_id !== b.id ||
            prior.user_id !== req.user.id ||
            prior.method !== d.method ||
            prior.outcome !== d.outcome
          )
            fail(
              409,
              "This request key was already used for a different payment",
            );
          return prior;
        }
        if (bookingStatus(b) !== "awaiting_payment")
          fail(
            409,
            "Payment is available only after approval and before the payment deadline",
          );
        if (await tx.get("SELECT id FROM payments WHERE booking_id=?", [b.id]))
          fail(409, "This booking is already paid");
        const running = await tx.get(
          "SELECT * FROM payment_attempts WHERE booking_id=? AND status='processing'",
          [b.id],
        );
        if (running) return running;
        const a = {
          id: randomUUID(),
          booking_id: b.id,
          user_id: req.user.id,
          ...d,
          status: "processing",
          amount: b.total,
          created_at: new Date().toISOString(),
          ready_at: new Date(Date.now() + 1500).toISOString(),
          completed_at: "",
        };
        const keys = Object.keys(a);
        await tx.run(
          `INSERT INTO payment_attempts (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
          Object.values(a),
        );
        await recordBookingEvent(
          tx,
          b.id,
          req.user,
          "payment_started",
          b.status,
          `Demo ${d.method} payment processing.`,
        );
        return a;
      });
      res.status(201).json({ attempt });
    },
  );
  app.post(
    "/api/payment-attempts/:id/complete",
    auth("user"),
    async (req, res) => {
      if (!demo) fail(503, "Demo payments are disabled");
      const result = await db.transaction(async (tx) => {
        const ref = await tx.get("SELECT * FROM payment_attempts WHERE id=?", [
          req.params.id,
        ]);
        if (!ref || ref.user_id !== req.user.id)
          fail(404, "Payment attempt not found");
        const b = await owned(tx, ref.booking_id, req.user);
        const a = await tx.get(
          "SELECT * FROM payment_attempts WHERE id=?" + tx.lock,
          [ref.id],
        );
        if (a.status !== "processing") return { attempt: a };
        if (Date.parse(a.ready_at) > Date.now()) return { attempt: a };
        const valid = bookingStatus(b) === "awaiting_payment";
        const status = !valid
          ? "expired"
          : a.outcome === "success"
            ? "paid"
            : "failed";
        const at = new Date().toISOString();
        if (status === "paid") {
          const exists = await tx.get(
            "SELECT id FROM payments WHERE booking_id=?",
            [b.id],
          );
          if (exists) fail(409, "Payment already recorded");
          await tx.run(
            "INSERT INTO payments (id,booking_id,user_id,kind,amount,status,provider,reference,created_at,method) VALUES (?,?,?,?,?,?,?,?,?,?)",
            [
              randomUUID(),
              b.id,
              b.user_id,
              "booking",
              b.total,
              "paid",
              "demo",
              `HH-${randomUUID()}`,
              at,
              a.method,
            ],
          );
          const next = b.flow_version === 2 ? "confirmed" : "pending_owner";
          await tx.run("UPDATE bookings SET status=? WHERE id=?", [next, b.id]);
          await recordBookingEvent(
            tx,
            b.id,
            req.user,
            "payment_received",
            next,
            `Demo ${a.method} payment recorded. No money transferred.`,
          );
          const h = await tx.get("SELECT * FROM hostels WHERE id=?", [
            b.hostel_id,
          ]);
          await notify(
            tx,
            b.user_id,
            "Payment received",
            `${h.name}: ${next === "confirmed" ? "your stay is confirmed" : "awaiting owner approval"}. Your demo receipt is ready.`,
          );
          await notify(
            tx,
            h.owner_id,
            "Guest payment received",
            `${req.user.name} paid the simulated booking amount for ${h.name}.`,
          );
        } else
          await recordBookingEvent(
            tx,
            b.id,
            req.user,
            status === "failed" ? "payment_failed" : "payment_expired",
            bookingStatus(b),
            status === "failed"
              ? "Payment declined by the demo simulator. You can retry."
              : "The booking is no longer payable. No charge recorded.",
          );
        await tx.run(
          "UPDATE payment_attempts SET status=?,completed_at=? WHERE id=?",
          [status, at, a.id],
        );
        return { attempt: { ...a, status, completed_at: at } };
      });
      res.json(result);
    },
  );
  app.get("/api/payments", auth(), async (req, res) => {
    // Owners also see their own subscription charges, which carry no booking_id
    // and so cannot match h.owner_id. Mirrors the owner dashboard's scope.
    const where =
      req.user.role === "admin"
        ? "1=1"
        : req.user.role === "owner"
          ? "(h.owner_id=? OR p.user_id=?)"
          : "p.user_id=?";
    const params =
      req.user.role === "admin"
        ? []
        : req.user.role === "owner"
          ? [req.user.id, req.user.id]
          : [req.user.id];
    res.json({
      payments: await db.all(
        `SELECT p.*,b.refund_amount,b.start_date,b.end_date,b.hostel_id,h.name AS hostel_name,u.name AS guest_name FROM payments p LEFT JOIN bookings b ON b.id=p.booking_id LEFT JOIN hostels h ON h.id=b.hostel_id JOIN users u ON u.id=p.user_id WHERE ${where} ORDER BY p.created_at DESC`,
        params,
      ),
    });
  });
  const escape = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  app.get("/api/bookings/:id/receipt", auth(), async (req, res) => {
    const p = await db.get(
      `SELECT p.*,b.rent,b.deposit,b.food_charge,b.service_charge,b.tax_amount,b.discount_amount,b.quantity,b.flow_version,b.monthly_rent,b.refund_amount,b.start_date,b.end_date,h.name AS hostel_name,h.owner_id,u.name AS guest_name,r.name AS room_name FROM payments p JOIN bookings b ON b.id=p.booking_id JOIN hostels h ON h.id=b.hostel_id JOIN users u ON u.id=b.user_id JOIN rooms r ON r.id=b.room_id WHERE b.id=?`,
      [req.params.id],
    );
    if (
      !p ||
      !(
        req.user.role === "admin" ||
        p.user_id === req.user.id ||
        (req.user.role === "owner" && p.owner_id === req.user.id)
      )
    )
      fail(404, "Receipt not found");
    const rows = [
      ["Receipt reference", p.reference],
      ["Issued", p.created_at],
      ["Guest", p.guest_name],
      ["Property", p.hostel_name],
      ["Room", `${p.room_name} · ${p.quantity} bed(s)`],
      ["Stay", `${p.start_date} to ${p.end_date}`],
      ["Payment method", p.method],
      ["Rent after discount", `INR ${p.rent}`],
      ["Deposit", `INR ${p.deposit}`],
      ["Food charge", `INR ${p.food_charge}`],
      ["Service charge", `INR ${p.service_charge}`],
      ["Tax", `INR ${p.tax_amount}`],
      ["Discount included", `INR ${p.discount_amount}`],
      ["Paid", `INR ${p.amount}`],
      ["Payment status", p.status],
      [
        "Refund processed",
        `INR ${p.status === "refunded" ? p.refund_amount : 0}`,
      ],
    ];
    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="HostelHub-receipt-${req.params.id.replace(/[^a-zA-Z0-9-]/g, "")}.html"`,
      "Cache-Control": "no-store",
    });
    res.send(
      `<!doctype html><html lang="en"><meta charset="utf-8"><title>Hostel Hub payment receipt</title><style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:24px;color:#234b40}table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #ddd}td:last-child{text-align:right}small{color:#555}@media print{body{margin:0}}</style><h1>Hostel Hub</h1><h2>Payment receipt</h2><p>Demo payment — no money transferred. This is not a tax invoice.</p><table>${rows.map(([k, v]) => `<tr><td>${escape(k)}</td><td>${escape(v)}</td></tr>`).join("")}</table><p>${p.flow_version === 2 ? "This receipt covers the first month and deposit. Later monthly rent is due separately." : ""}</p><small>Save this file or use your browser's Print → Save as PDF.</small></html>`,
    );
  });
}
