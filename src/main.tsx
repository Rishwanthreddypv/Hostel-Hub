import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  BedDouble,
  Bell,
  X,
  Menu,
  LogOut,
  ChevronRight,
  GitCompareArrows,
  CircleCheck,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { api, money, type User } from "./api";
import { Ctx, useApp, Guard, Empty, Loading } from "./shared";
import { Explore, Details, Compare } from "./homes";
import { Auth, Profile, Notifications, Messages, Support } from "./account";
import { Bookings } from "./bookings";
import { Payments } from "./portfolio";
import { Owner, Admin, Plans } from "./management";
import "./styles.css";
function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [config, setConfig] = useState<any>({ demo: true }),
    [saved, setSaved] = useState<string[]>([]),
    [compare, setCompare] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("hh-compare") || "[]").slice(
          0,
          3,
        );
      } catch {
        return [];
      }
    }),
    [toastText, setToast] = useState("");
  const toast = (s: string) => setToast(s);
  const refresh = async () => {
    const { user } = await api("/auth/me");
    setUser(user);
    setSaved(user ? (await api("/wishlist")).ids : []);
  };
  useEffect(() => {
    Promise.all([refresh(), api("/config").then(setConfig)])
      .catch((e) => toast(e.message))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (toastText) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toastText]);
  const toggleSave = async (id: string) => {
    if (!user) return toast("Sign in to save your favourite homes.");
    try {
      await api("/wishlist/" + id, "POST");
      await refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const toggleCompare = (id: string) =>
    setCompare((current) => {
      if (!current.includes(id) && current.length >= 3) {
        toast("You can compare up to 3 homes.");
        return current;
      }
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      localStorage.setItem("hh-compare", JSON.stringify(next));
      return next;
    });
  if (!ready) return <Loading />;
  return (
    <Ctx.Provider
      value={{
        user,
        config,
        refresh,
        toast,
        saved,
        toggleSave,
        compare,
        toggleCompare,
      }}
    >
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/hostels/:id" element={<Details />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route
            path="/wishlist"
            element={
              <Guard>
                <Explore wishlist />
              </Guard>
            }
          />
          <Route path="/compare" element={<Compare />} />
          <Route
            path="/bookings"
            element={
              <Guard>
                <Bookings />
              </Guard>
            }
          />
          <Route
            path="/owner"
            element={
              <Guard roles={["owner"]}>
                <Owner />
              </Guard>
            }
          />
          <Route
            path="/owner/plans"
            element={
              <Guard roles={["owner"]}>
                <Plans />
              </Guard>
            }
          />
          <Route
            path="/admin"
            element={
              <Guard roles={["admin"]}>
                <Admin />
              </Guard>
            }
          />
          <Route
            path="/profile"
            element={
              <Guard>
                <Profile />
              </Guard>
            }
          />
          <Route
            path="/payments"
            element={
              <Guard>
                <Payments />
              </Guard>
            }
          />
          <Route
            path="/notifications"
            element={
              <Guard>
                <Notifications />
              </Guard>
            }
          />
          <Route
            path="/messages"
            element={
              <Guard>
                <Messages />
              </Guard>
            }
          />
          <Route
            path="/support"
            element={
              <Guard>
                <Support />
              </Guard>
            }
          />
          <Route
            path="*"
            element={
              <Empty
                title="This page moved out"
                body="Let’s find you somewhere better."
              >
                <Link className="button" to="/">
                  Explore homes
                </Link>
              </Empty>
            }
          />
        </Routes>
      </main>
      <Footer />
      <Assistant />
      {compare.length > 0 && (
        <Link to="/compare" className="compare-float">
          <GitCompareArrows size={18} /> Compare homes <b>{compare.length}</b>
          <ArrowRight size={17} />
        </Link>
      )}
      {toastText && (
        <div className="toast" role="status">
          <CircleCheck size={20} />
          {toastText}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}
function Header() {
  const { user, refresh, config } = useApp();
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let active = true;
    const load = () =>
      api("/notifications")
        .then((d) => {
          if (active)
            setCount(d.notifications.filter((n: any) => !n.is_read).length);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [user]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div className="header-inner">
          <Link className="brand" to="/">
            <span className="brand-icon">
              <BedDouble size={24} />
            </span>
            hostel
            <span>
              hub<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav className="desktop-nav">
            <NavLink end to="/">
              Explore homes
            </NavLink>
            {user?.role === "owner" ? (
              <NavLink to="/owner">Owner dashboard</NavLink>
            ) : user?.role === "admin" ? (
              <NavLink to="/admin">Admin dashboard</NavLink>
            ) : (
              <NavLink to="/wishlist">Saved homes</NavLink>
            )}
            <NavLink to="/bookings">
              {user && user.role !== "user" ? "Bookings" : "My bookings"}
            </NavLink>
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link
                  className="icon-button notification-button"
                  to="/notifications"
                  aria-label={`Notifications, ${count} unread`}
                >
                  <Bell size={20} />
                  {count > 0 && <i />}
                </Link>
                <button
                  className="avatar"
                  aria-label="Account menu"
                  onClick={() => setMenu(!menu)}
                >
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </button>
              </>
            ) : (
              <>
                <Link className="owner-link" to="/register?role=owner">
                  List your property <ArrowUpRight size={15} />
                </Link>
                <Link className="button small" to="/login">
                  Sign in <ArrowRight size={15} />
                </Link>
              </>
            )}
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Navigation menu"
            >
              <Menu />
            </button>
          </div>
          {menu && (
            <div className="account-menu">
              <div className="menu-user">
                <b>{user?.name || "Welcome home"}</b>
                <small>
                  {user?.email || "Find a space that feels like you"}
                </small>
              </div>
              {[
                ["/", "Explore homes"],
                ["/wishlist", "Saved homes"],
                ["/payments", "Payments & receipts"],
                ["/bookings", "Bookings"],
                ...(user?.role === "owner"
                  ? [
                      ["/owner", "Owner dashboard"],
                      ["/owner/plans", "Provider plans"],
                    ]
                  : user?.role === "admin"
                    ? [["/admin", "Admin dashboard"]]
                    : []),
                ["/profile", "My profile"],
                ["/messages", "Messages"],
                ["/support", "Help & support"],
              ].map(([to, label]) => (
                <Link key={to} to={to} onClick={() => setMenu(false)}>
                  {label}
                  <ChevronRight size={15} />
                </Link>
              ))}
              {user ? (
                <button
                  onClick={async () => {
                    await api("/auth/logout", "POST");
                    await refresh();
                    setMenu(false);
                    navigate("/");
                  }}
                >
                  Sign out
                  <LogOut size={16} />
                </button>
              ) : (
                <Link to="/login" onClick={() => setMenu(false)}>
                  Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </header>
      {config.demo && (
        <div className="demo-ribbon">
          COLLEGE PROJECT DEMO{" "}
          <span>Sample properties · Simulated payments · No real charges</span>
        </div>
      )}
    </>
  );
}
function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <Link className="brand" to="/">
          <BedDouble size={24} /> hostelhub.
        </Link>
        <span>A place for your next chapter.</span>
        <Link to="/support">
          Help & support <ArrowUpRight size={14} />
        </Link>
        <small>© {new Date().getFullYear()} Hostel Hub</small>
      </div>
    </footer>
  );
}
function Assistant() {
  const { config } = useApp();
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<any[]>([
      {
        role: "assistant",
        text: "Hey, future neighbour! Tell me your city and budget, or ask how booking works.",
        homes: [],
      },
    ]);
  const send = async (message: string) => {
    setInput("");
    setBusy(true);
    setHistory((h) => [...h, { role: "user", text: message }]);
    try {
      const d = await api("/assistant", "POST", { message });
      setHistory((h) => [
        ...h,
        { role: "assistant", text: d.answer, homes: d.hostels, mode: d.mode },
      ]);
    } catch (e) {
      setHistory((h) => [
        ...h,
        { role: "assistant", text: (e as Error).message },
      ]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {open ? (
        <aside className="assistant-panel" aria-label="Hostel search assistant">
          <div className="assistant-heading">
            <span>
              <Sparkles size={19} />
              <b>Your home-finding helper</b>
              <small>
                {config.assistant === "ai"
                  ? "AI with local search fallback"
                  : "Local search assistant · demo"}
              </small>
            </span>
            <button aria-label="Close assistant" onClick={() => setOpen(false)}>
              <X size={19} />
            </button>
          </div>
          <div className="assistant-conversation" aria-live="polite">
            {history.map((m, i) => (
              <div className={"assistant-message " + m.role} key={i}>
                <p>{m.text}</p>
                {m.homes?.map((h: any) => (
                  <Link
                    key={h.id}
                    to={"/hostels/" + h.id}
                    onClick={() => setOpen(false)}
                  >
                    <span>
                      <b>{h.name}</b>
                      <small>
                        {h.city} · {money(h.rent)}/month
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </div>
            ))}
            {busy && <p className="muted">Finding a little inspiration…</p>}
          </div>
          {history.length === 1 && (
            <button
              className="assistant-suggestion"
              onClick={() => send("Girls hostel in Chennai under 8k")}
            >
              Girls hostel in Chennai under ₹8,000 <ArrowRight size={14} />
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) send(input);
            }}
          >
            <input
              aria-label="Ask the hostel assistant"
              maxLength={1200}
              placeholder="City, budget, a little wish list…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button disabled={busy || !input.trim()} aria-label="Send question">
              <ArrowRight size={19} />
            </button>
          </form>
        </aside>
      ) : (
        <button
          className="assistant-launch"
          aria-label="Find my kind of home"
          onClick={() => setOpen(true)}
        >
          <Sparkles size={19} />
          <span>Find my kind of home</span>
          <MessageCircle size={18} />
        </button>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
