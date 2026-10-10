import React, { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Bell,
  Check,
  Send,
} from "lucide-react";
import { api, dateLabel } from "./api";
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
export function Auth({ register = false }: { register?: boolean }) {
  const { refresh, toast, user, config } = useApp();
  const [params] = useSearchParams();
  const [role, setRole] = useState(
      params.get("role") === "owner" ? "owner" : "user",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (user)
    return (
      <Navigate
        to={
          user.role === "owner"
            ? "/owner"
            : user.role === "admin"
              ? "/admin"
              : "/"
        }
      />
    );
  const submit = async (e?: React.FormEvent, quick?: string) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api(
        "/auth/" + (register ? "register" : "login"),
        "POST",
        {
          email: quick
            ? config.demo_accounts?.find(
                (a: any) =>
                  a.id ===
                  (quick === "owner"
                    ? "csv-owner-01"
                    : quick === "user"
                      ? "csv-guest-001"
                      : "admin-demo"),
              )?.email || `${quick}@hostelhub.test`
            : email,
          password: quick ? "HostelHub@123" : password,
          ...(register ? { name, role } : {}),
        },
      );
      await refresh();
      navigate(
        result.user.role === "owner"
          ? "/owner"
          : result.user.role === "admin"
            ? "/admin"
            : "/",
      );
      toast("Welcome " + result.user.name.split(" ")[0] + ".");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-layout">
      <div className="auth-visual">
        <img src="/images/hero.jpg" alt="A comfortable communal living space" />
        <div>
          <span className="eyebrow">A LITTLE CLOSER TO HOME</span>
          <h1>
            Good things
            <br />
            start with
            <br />
            <em>belonging.</em>
          </h1>
          <p>Your space. Your people. Your next chapter.</p>
        </div>
      </div>
      <div className="auth-form">
        <Link className="back-link" to="/">
          <ArrowLeft size={16} />
          Back to exploring
        </Link>
        <span className="eyebrow">WELCOME TO HOSTEL HUB</span>
        <h1>{register ? "Make yourself at home." : "Welcome back."}</h1>
        <p>
          {register
            ? "A new chapter is just around the corner."
            : "Your next home is waiting for you."}
        </p>
        <form onSubmit={submit}>
          <ErrorBox error={error} />
          {register && (
            <>
              <div className="segmented">
                {["user", "owner"].map((r) => (
                  <button
                    type="button"
                    className={role === r ? "active" : ""}
                    key={r}
                    onClick={() => setRole(r)}
                  >
                    {r === "user" ? "I’m finding a home" : "I’m a hostel owner"}
                  </button>
                ))}
              </div>
              <Field label="Full name">
                <input
                  autoComplete="name"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Email address">
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 10 : 1}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                register ? "At least 10 characters" : "Your password"
              }
            />
          </Field>
          <button disabled={busy} className="button full">
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already feel at home?" : "New around here?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {config.demo && !register && (
          <div className="demo-accounts">
            <span>EXPLORE THE DEMO</span>
            <div>
              {["user", "owner", "admin"].map((r) => (
                <button
                  disabled={busy}
                  className="button secondary small"
                  key={r}
                  onClick={() => submit(undefined, r)}
                >
                  {r === "user" ? "Guest" : r === "owner" ? "Owner" : "Admin"}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
            <small>Sample accounts · no real payments</small>
            {config.demo_accounts?.length > 0 && (
              <Field label="Choose an independent demo account">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setPassword("HostelHub@123");
                  }}
                >
                  <option value="" disabled>
                    Select an owner or resident, then sign in
                  </option>
                  {config.demo_accounts.map((a: any) => (
                    <option value={a.email} key={a.id}>
                      {a.name} · {a.role} · {a.email}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export function Profile() {
  const { user, refresh, toast } = useApp();
  const [form, setForm] = useState({
      name: user!.name,
      phone: user!.phone,
      bio: user!.bio,
    }),
    [password, setPassword] = useState({ current: "", password: "" }),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow="YOUR ACCOUNT"
        title="Make it yours."
        subtitle="A few details to help your host welcome you."
      />
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/profile", "PATCH", form);
            await refresh();
            toast("Profile updated.");
          } catch (e) {
            toast((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="profile-header">
          <span className="avatar large">{user!.name[0]}</span>
          <div>
            <b>{user!.email}</b>
            <p>{user!.role} account</p>
          </div>
        </div>
        <Field label="Full name">
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            maxLength={30}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="A little about you">
          <textarea
            maxLength={1000}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </Field>
        <button className="button" disabled={busy}>
          Save profile
        </button>
      </form>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/profile/password", "POST", password);
            await refresh();
            navigate("/login");
            toast("Password changed. Please sign in again.");
          } catch (e) {
            toast((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Update password</h2>
        <Field label="Current password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password.current}
            onChange={(e) =>
              setPassword({ ...password, current: e.target.value })
            }
          />
        </Field>
        <Field label="New password (at least 10 characters)">
          <input
            type="password"
            minLength={10}
            maxLength={72}
            required
            autoComplete="new-password"
            value={password.password}
            onChange={(e) =>
              setPassword({ ...password, password: e.target.value })
            }
          />
        </Field>
        <button className="button secondary" disabled={busy}>
          Change password
        </button>
      </form>
    </div>
  );
}
export function Notifications() {
  const { toast } = useApp();
  const { data, error, load } = useLoad("/notifications");
  useEffect(() => {
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow="STAY IN THE LOOP"
        title="Your updates."
        subtitle="Booking news, messages and the little things that matter."
      >
        <button
          className="button secondary small"
          onClick={async () => {
            try {
              await api("/notifications/read", "POST");
              await load();
              toast("All caught up.");
            } catch (e) {
              toast((e as Error).message);
            }
          }}
        >
          Mark all read
          <Check size={16} />
        </button>
      </PageTitle>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.notifications.length ? (
        <div className="notification-list">
          {data.notifications.map((n: any) => (
            <article className={n.is_read ? "" : "unread"} key={n.id}>
              <span className="trust-icon">
                <Bell size={20} />
              </span>
              <div>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <small>{dateLabel(n.created_at)}</small>
              </div>
              {!n.is_read && <i />}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="You’re all caught up"
          body="Updates will appear here as you explore and book."
        />
      )}
    </div>
  );
}
export function Messages() {
  const [property, setProperty] = useState("");
  const { user, toast } = useApp();
  const { data, error, load } = useLoad("/messages");
  const [thread, setThread] = useState(""),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  const threads: any = {};
  for (const m of (data?.messages || []).filter(
    (m: any) => !property || m.hostel_id === property,
  )) {
    const other = m.sender_id === user!.id ? m.recipient_id : m.sender_id;
    const key = m.hostel_id + "|" + other;
    if (!threads[key])
      threads[key] = {
        hostel: m.hostel_name,
        hostel_id: m.hostel_id,
        other,
        name: m.sender_id === user!.id ? m.recipient_name : m.sender_name,
        messages: [],
      };
    threads[key].messages.push(m);
  }
  const selected = threads[thread];
  return (
    <div className="page">
      <PageTitle
        eyebrow="A CONVERSATION STARTS HERE"
        title="Your messages."
        subtitle="Get to know your host. Ask the little questions before you move."
      />
      <Field label="Filter conversations by property">
        <select
          value={property}
          onChange={(e) => {
            setProperty(e.target.value);
            setThread("");
          }}
        >
          <option value="">All properties</option>
          {[
            ...new Map(
              (data?.messages || []).map((m: any) => [
                m.hostel_id,
                m.hostel_name,
              ]),
            ).entries(),
          ].map(([id, name]: any) => (
            <option value={id} key={id}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : Object.keys(threads).length ? (
        <div className="messages-layout">
          <aside>
            {Object.entries(threads).map(([key, t]: any) => (
              <button
                className={key === thread ? "active" : ""}
                key={key}
                onClick={() => setThread(key)}
              >
                <span className="avatar">{t.name[0]}</span>
                <div>
                  <b>{t.name}</b>
                  <small>{t.hostel}</small>
                  <p>{t.messages.at(-1).body.slice(0, 45)}</p>
                </div>
              </button>
            ))}
          </aside>
          <section>
            {selected ? (
              <>
                <div className="conversation-heading">
                  <h3>{selected.name}</h3>
                  <small>{selected.hostel}</small>
                </div>
                <div className="conversation">
                  {selected.messages.map((m: any) => (
                    <div
                      key={m.id}
                      className={
                        "message " + (m.sender_id === user!.id ? "mine" : "")
                      }
                    >
                      <p>{m.body}</p>
                      <small>
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                  ))}
                </div>
                <form
                  className="message-compose"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      await api("/messages", "POST", {
                        hostel_id: selected.hostel_id,
                        recipient_id: selected.other,
                        body: draft,
                      });
                      setDraft("");
                      await load();
                    } catch (e) {
                      toast((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <input
                    aria-label="Reply"
                    required
                    maxLength={2000}
                    placeholder="Write a message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button
                    className="button"
                    disabled={busy}
                    aria-label="Send reply"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </>
            ) : (
              <Empty
                title="Say hello"
                body="Choose a conversation to get started."
              />
            )}
          </section>
        </div>
      ) : (
        <Empty
          title="Your conversations live here"
          body="Visit a hostel and select ‘Contact host’ to start a conversation."
        >
          <Link className="button" to="/">
            Explore homes
          </Link>
        </Empty>
      )}
    </div>
  );
}
export function Support() {
  const { user, toast } = useApp();
  const { data, error, load } = useLoad("/complaints");
  const [form, setForm] = useState({ subject: "", body: "" }),
    [open, setOpen] = useState(false),
    [resolve, setResolve] = useState(""),
    [resolution, setResolution] = useState("");
  return (
    <div className="page narrow">
      <PageTitle
        eyebrow="WE’RE HERE TO HELP"
        title={
          user?.role === "admin" ? "Support requests." : "Let’s work it out."
        }
        subtitle="A question, concern or something that needs attention."
      />
      {user?.role !== "admin" && (
        <button className="button" onClick={() => setOpen(true)}>
          <Plus size={17} />
          New support request
        </button>
      )}
      <ErrorBox error={error} />
      <div className="support-list">
        {data?.complaints.map((c: any) => (
          <article className="panel" key={c.id}>
            <Badge status={c.status}>{c.status}</Badge>
            <h3>{c.subject}</h3>
            <p>{c.body}</p>
            <small>
              {user?.role === "admin" ? c.name + " · " : ""}
              {dateLabel(c.created_at)}
            </small>
            {c.resolution && (
              <div className="info-box">
                <b>Resolution</b>
                <p>{c.resolution}</p>
              </div>
            )}
            {user?.role === "admin" && c.status === "open" && (
              <button
                className="text-button"
                onClick={() => {
                  setResolve(c.id);
                  setResolution("");
                }}
              >
                Resolve request <ArrowRight size={15} />
              </button>
            )}
          </article>
        ))}
        {data && !data.complaints.length && (
          <Empty
            title="Nothing unresolved"
            body="Any support requests you create will appear here."
          />
        )}
      </div>
      {open && (
        <Modal title="How can we help?" onClose={() => setOpen(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/complaints", "POST", form);
                setOpen(false);
                setForm({ subject: "", body: "" });
                await load();
                toast("Support request created.");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <Field label="Subject">
              <input
                required
                maxLength={160}
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </Field>
            <Field label="Tell us what happened">
              <textarea
                required
                maxLength={3000}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </Field>
            <button className="button">Send request</button>
          </form>
        </Modal>
      )}
      {resolve && (
        <Modal title="Resolve support request" onClose={() => setResolve("")}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/admin/complaints/" + resolve, "POST", {
                  resolution,
                });
                setResolve("");
                await load();
                toast("Resolution sent to the member.");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <Field label="Resolution shared with the member">
              <textarea
                required
                maxLength={3000}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </Field>
            <button className="button">Resolve & notify</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
