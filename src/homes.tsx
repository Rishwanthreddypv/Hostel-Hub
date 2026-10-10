import React, { useState, useEffect, useRef } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  MapPin,
  ShieldCheck,
  Heart,
  Search,
  SlidersHorizontal,
  Star,
  Check,
  Plus,
  Leaf,
  Users,
  Map,
  Grid2X2,
  BedDouble,
  Clock,
  MessageCircle,
  CreditCard,
  LockKeyhole,
  ExternalLink,
  X,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, money, dateLabel, nextDate, type Hostel } from "./api";
import {
  useApp,
  useLoad,
  Field,
  Icon,
  Badge,
  Modal,
  Loading,
  Empty,
  ErrorBox,
  PageTitle,
} from "./shared";
export function HostelCard({ h }: { h: Hostel }) {
  const { saved, toggleSave, compare, toggleCompare } = useApp();
  return (
    <article className="hostel-card">
      <div className="card-photo">
        <Link to={"/hostels/" + h.id}>
          <img
            src={h.photos[0] || "/images/room-1.jpg"}
            alt={`${h.name} room`}
            loading="lazy"
          />
        </Link>
        <span className="verified">
          <ShieldCheck size={13} /> Verified listing
        </span>
        <button
          className={`save-button ${saved.includes(h.id) ? "saved" : ""}`}
          aria-label={
            saved.includes(h.id) ? `Unsave ${h.name}` : `Save ${h.name}`
          }
          onClick={() => toggleSave(h.id)}
        >
          <Heart
            size={19}
            fill={saved.includes(h.id) ? "currentColor" : "none"}
          />
        </button>
        {h.discount > 0 && (
          <span className="offer-tag">{h.discount}% off rent</span>
        )}
      </div>
      <div className="card-content">
        <div className="card-meta">
          <span>{h.gender}</span>
          <span className="rating">
            <Star size={13} fill="currentColor" />
            {h.rating ? h.rating.toFixed(1) : "New"}
            {h.review_count > 0 && <small>({h.review_count})</small>}
          </span>
        </div>
        <Link to={"/hostels/" + h.id}>
          <h3>{h.name}</h3>
        </Link>
        <p className="location">
          <MapPin size={14} />
          {h.area}, {h.city}
          {h.distance !== undefined && ` · ${h.distance.toFixed(1)} km`}
        </p>
        <div className="amenities">
          {h.facilities.slice(0, 3).map((f) => (
            <span key={f}>
              <Icon name={f} />
              {f}
            </span>
          ))}
          {h.facilities.length > 3 && <span>+{h.facilities.length - 3}</span>}
        </div>
        <div className="card-bottom">
          <div>
            <small>Starting from</small>
            <p>
              <strong>
                {money(Math.round(h.min_rent * (1 - h.discount / 100)))}
              </strong>
              <span> / month</span>
            </p>
          </div>
          <Link
            className="round-link"
            to={"/hostels/" + h.id}
            aria-label={`View ${h.name}`}
          >
            <ArrowUpRight size={21} />
          </Link>
        </div>
        <label className="compare-check">
          <input
            type="checkbox"
            checked={compare.includes(h.id)}
            onChange={() => toggleCompare(h.id)}
          />
          Add to compare{" "}
          <span>{h.available > 0 ? "Beds available" : "Check dates"}</span>
        </label>
      </div>
    </article>
  );
}
export function Explore({ wishlist = false }: { wishlist?: boolean }) {
  const { saved } = useApp();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || ""),
    [mode, setMode] = useState("grid"),
    [filters, setFilters] = useState(false);
  const [lat, setLat] = useState(""),
    [lng, setLng] = useState("");
  const set = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    setParams(p);
  };
  const { data, error } = useLoad<{ hostels: Hostel[] }>(
    "/hostels?" + params.toString(),
  );
  let homes = data?.hostels || [];
  if (wishlist) homes = homes.filter((h) => saved.includes(h.id));
  const facility = (f: string) => {
    const fs = (params.get("facilities") || "").split(",").filter(Boolean);
    set(
      "facilities",
      fs.includes(f)
        ? fs.filter((x) => x !== f).join(",")
        : [...fs, f].join(","),
    );
  };
  return (
    <>
      <section className={`hero ${wishlist ? "compact" : ""}`}>
        <div className="hero-copy">
          <div className="eyebrow">
            <span />{" "}
            {wishlist
              ? "YOUR PERSONAL SHORTLIST"
              : "GOOD PLACES. GREAT BEGINNINGS."}
          </div>
          <h1>
            {wishlist ? (
              <>
                Homes you <em>love.</em>
              </>
            ) : (
              <>
                New city.
                <br />
                Your kind of <em>home.</em>
              </>
            )}
          </h1>
          <p>
            {wishlist
              ? "Keep your favourites close. Your next chapter is waiting."
              : "Find a hostel that fits your life. Thoughtful spaces, verified owners, and a community to call your own."}
          </p>
          {!wishlist && (
            <div className="hero-trust">
              <span>
                <ShieldCheck size={17} />
                Verified listings
              </span>
              <span>
                <Check size={17} />
                Transparent pricing
              </span>
              <span>
                <Heart size={17} />
                Made for you
              </span>
            </div>
          )}
        </div>
        {!wishlist && (
          <div className="hero-visual">
            <img
              src="/images/hero.jpg"
              alt="Warm, sunlit shared living room with plants and comfortable seating"
            />
            <div className="hero-image-shade" />
            <span className="image-caption">
              <MapPin size={14} /> Find your corner of the city
            </span>
            <div className="hero-note">
              <span>
                <Leaf size={20} />
              </span>
              <div>
                More than a room.<small>A fresh start.</small>
              </div>
            </div>
            <span className="hero-mark">
              settle in.
              <br />
              stand out.
            </span>
          </div>
        )}
      </section>
      <div className="content-wrap">
        <form
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            set("q", query);
          }}
        >
          <label className="search-location">
            <MapPin size={21} />
            <span>
              <small>WHERE DO YOU WANT TO LIVE?</small>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="City, neighbourhood or college"
                aria-label="Search city, neighbourhood or college"
              />
            </span>
          </label>
          <label className="search-type">
            <Users size={20} />
            <span>
              <small>LOOKING FOR</small>
              <select
                aria-label="Hostel gender"
                value={params.get("gender") || ""}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">A place for anyone</option>
                <option>Boys</option>
                <option>Girls</option>
                <option>Co-living</option>
              </select>
            </span>
          </label>
          <button className="button search-submit">
            <Search size={19} />
            Find my space
          </button>
        </form>
        <div className="quick-cities">
          <span>Popular places</span>
          {["Chennai", "Bengaluru", "Hyderabad"].map((c) => (
            <button
              key={c}
              onClick={() => {
                setQuery(c);
                set("q", c);
              }}
            >
              {c}
              <ArrowUpRight size={12} />
            </button>
          ))}
        </div>
        <section className="discover">
          <div className="section-heading">
            <div>
              <div className="eyebrow">A SPACE THAT FEELS LIKE YOU</div>
              <h2>
                {wishlist ? "Your saved homes" : "Find your next chapter"}
                <span className="dot">.</span>
              </h2>
              <p>
                {wishlist
                  ? "Your shortlist, all in one place."
                  : "A little comfort. A little community. A place to belong."}
              </p>
            </div>
            <div className="view-switch">
              <button
                className={mode === "grid" ? "active" : ""}
                onClick={() => setMode("grid")}
              >
                <Grid2X2 size={16} />
                List
              </button>
              <button
                className={mode === "map" ? "active" : ""}
                onClick={() => setMode("map")}
              >
                <Map size={16} />
                Map
              </button>
            </div>
          </div>
          <div className="filter-toolbar">
            <div className="filter-chips">
              <button
                className={!params.get("gender") ? "active" : ""}
                onClick={() => set("gender", "")}
              >
                All homes
              </button>
              {["Boys", "Girls", "Co-living"].map((g) => (
                <button
                  key={g}
                  className={params.get("gender") === g ? "active" : ""}
                  onClick={() => set("gender", g)}
                >
                  {g === "Boys" ? "For him" : g === "Girls" ? "For her" : g}
                </button>
              ))}
              <button
                className={filters ? "active" : ""}
                onClick={() => setFilters(!filters)}
              >
                <SlidersHorizontal size={15} />
                More filters
              </button>
            </div>
            <label className="sort">
              Sort by{" "}
              <select
                aria-label="Sort homes"
                value={params.get("sort") || "recommended"}
                onChange={(e) => set("sort", e.target.value)}
              >
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>
          {filters && (
            <div className="filters-panel">
              <Field label="Monthly budget">
                <select
                  value={params.get("budget") || ""}
                  onChange={(e) => set("budget", e.target.value)}
                >
                  <option value="">Any budget</option>
                  {[6000, 8000, 10000, 15000, 20000, 25000, 30000].map((v) => (
                    <option value={v} key={v}>
                      Up to {money(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Room sharing">
                <select
                  value={params.get("sharing") || ""}
                  onChange={(e) => set("sharing", e.target.value)}
                >
                  <option value="">Any room</option>
                  <option value="1">Single</option>
                  <option value="2">Double</option>
                  <option value="3">Triple</option>
                  <option value="4">Four sharing</option>
                </select>
              </Field>
              <Field label="Cooling">
                <select
                  value={params.get("ac") || ""}
                  onChange={(e) => set("ac", e.target.value)}
                >
                  <option value="">AC / Non-AC</option>
                  <option value="true">AC</option>
                  <option value="false">Non-AC</option>
                </select>
              </Field>
              <Field label="Minimum rating">
                <select
                  value={params.get("rating") || ""}
                  onChange={(e) => set("rating", e.target.value)}
                >
                  <option value="">Any rating</option>
                  <option value="4">4+ stars</option>
                  <option value="3">3+ stars</option>
                </select>
              </Field>
              <Field label="Move-in">
                <input
                  type="date"
                  min={nextDate(0)}
                  value={params.get("start") || ""}
                  onChange={(e) => {
                    const p = new URLSearchParams(params);
                    if (e.target.value) {
                      p.set("start", e.target.value);
                      const end = new Date(e.target.value);
                      end.setDate(end.getDate() + 30);
                      p.set("end", end.toISOString().slice(0, 10));
                    } else {
                      p.delete("start");
                      p.delete("end");
                    }
                    setParams(p);
                  }}
                />
              </Field>
              <Field label="Move-out">
                <input
                  type="date"
                  min={params.get("start") || nextDate(1)}
                  value={params.get("end") || ""}
                  onChange={(e) => set("end", e.target.value)}
                />
              </Field>
              <div className="filter-facilities">
                {["Wi-Fi", "Food", "Parking", "Laundry", "Security", "Gym", "Power backup", "Kitchen"].map(
                  (f) => (
                    <label key={f}>
                      <input
                        type="checkbox"
                        checked={(params.get("facilities") || "")
                          .split(",")
                          .includes(f)}
                        onChange={() => facility(f)}
                      />
                      <Icon name={f} />
                      {f}
                    </label>
                  ),
                )}
              </div>
              <div className="distance-filter">
                <input
                  type="number"
                  aria-label="Latitude"
                  placeholder="Latitude"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
                <input
                  type="number"
                  aria-label="Longitude"
                  placeholder="Longitude"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                />
                <select
                  aria-label="Distance"
                  value={params.get("distance") || "10"}
                  onChange={(e) => {
                    const p = new URLSearchParams(params);
                    p.set("lat", lat);
                    p.set("lng", lng);
                    p.set("distance", e.target.value);
                    setParams(p);
                  }}
                  disabled={!lat || !lng}
                >
                  <option value="5">Within 5 km</option>
                  <option value="10">Within 10 km</option>
                  <option value="20">Within 20 km</option>
                  <option value="50">Within 50 km</option>
                </select>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setParams({});
                  setQuery("");
                }}
              >
                Clear all filters
              </button>
            </div>
          )}
          <div className="results-line">
            <span>
              {data
                ? `${homes.length} homes to make your own`
                : "Finding your space…"}
            </span>
            <span>
              <ShieldCheck size={14} />
              Every published listing is reviewed
            </span>
          </div>
          <ErrorBox error={error} />
          {!data && !error ? (
            <Loading />
          ) : homes.length === 0 ? (
            <Empty
              title={
                wishlist
                  ? "Your favourites start here"
                  : "No homes match just yet"
              }
              body={
                wishlist
                  ? "Tap the heart on any hostel to save it."
                  : "Try another neighbourhood or relax a filter."
              }
            >
              <Link className="button secondary" to="/">
                Explore all homes
              </Link>
            </Empty>
          ) : mode === "map" ? (
            <MapView homes={homes} />
          ) : (
            <div className="hostel-grid">
              {homes.map((h) => (
                <HostelCard key={h.id} h={h} />
              ))}
            </div>
          )}
        </section>
        {!wishlist && (
          <>
            <section className="trust-strip">
              <div>
                <span className="trust-icon">
                  <ShieldCheck />
                </span>
                <h3>Trust comes first</h3>
                <p>Owner documents reviewed before a home goes live.</p>
              </div>
              <div>
                <span className="trust-icon">
                  <CreditCard />
                </span>
                <h3>Know what you pay</h3>
                <p>Clear rent, deposit and cancellation terms. No surprises.</p>
              </div>
              <div>
                <span className="trust-icon">
                  <MessageCircle />
                </span>
                <h3>Talk before you move</h3>
                <p>Ask the owner your questions and arrive with confidence.</p>
              </div>
            </section>
            <section className="owner-cta">
              <div>
                <span className="eyebrow">HAVE A PLACE TO SHARE?</span>
                <h2>Your space. Someone’s fresh start.</h2>
                <p>Bring your hostel to a community looking for home.</p>
              </div>
              <Link className="button light" to="/register?role=owner">
                List your property <ArrowUpRight size={18} />
              </Link>
            </section>
          </>
        )}
      </div>
    </>
  );
}
export function MapView({ homes }: { homes: Hostel[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !homes.length) return;
    const map = L.map(ref.current).setView(
      [homes[0].latitude, homes[0].longitude],
      12,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const markers = homes.map((h) => {
      const el = document.createElement("a");
      el.textContent = `${h.name} · ${money(h.min_rent)}/month`;
      el.href = "/hostels/" + h.id;
      return L.marker([h.latitude, h.longitude], {
        icon: L.divIcon({
          className: "price-pin",
          html: `<span>${money(h.min_rent)}</span>`,
          iconSize: [84, 30],
        }),
      })
        .addTo(map)
        .bindPopup(el);
    });
    if (markers.length > 1)
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
    return () => {
      map.remove();
    };
  }, [homes]);
  return (
    <div className="map-layout">
      <div
        className="map"
        ref={ref}
        aria-label="Map showing hostel locations"
      />
      <div className="map-list">
        {homes.map((h) => (
          <Link key={h.id} to={"/hostels/" + h.id}>
            <img src={h.photos[0]} alt="" />
            <div>
              <b>{h.name}</b>
              <small>
                {h.area}, {h.city}
              </small>
              <strong>{money(h.min_rent)} / mo</strong>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </div>
    </div>
  );
}
export function Details() {
  const { id } = useParams();
  const { user, toast, toggleSave, saved, config } = useApp();
  const [start, setStart] = useState(nextDate(1)),
    [end, setEnd] = useState(nextDate(31)),
    [room, setRoom] = useState(""),
    [quantity, setQuantity] = useState(1),
    [guestNote, setGuestNote] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(false),
    [photo, setPhoto] = useState<string | null>(null),
    [draft, setDraft] = useState("");
  const navigate = useNavigate();
  const { data, error } = useLoad<{ hostel: Hostel; reviews: any[] }>(
    "/hostels/" + id + "?start=" + start + "&end=" + end,
  );
  useEffect(() => {
    if (data && !room) setRoom(data.hostel.rooms[0]?.id || "");
  }, [data]);
  if (error)
    return (
      <div className="page">
        <ErrorBox error={error} />
        <button
          className="button"
          onClick={() => {
            setStart(nextDate(1));
            setEnd(nextDate(31));
          }}
        >
          Reset dates
        </button>
      </div>
    );
  if (!data) return <Loading />;
  const h = data.hostel,
    r = h.rooms.find((r) => r.id === room);
  const nights = Math.max(0, (Date.parse(end) - Date.parse(start)) / 86400000),
    rent = r
      ? r.rent * quantity - Math.round((r.rent * quantity * h.discount) / 100)
      : 0,
    food = h.food_charge * quantity,
    services = h.service_charge * quantity,
    tax = Math.round(((rent + food + services) * h.tax_percent) / 100),
    total = rent + h.deposit * quantity + food + services + tax;
  const reserve = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    try {
      const d = await api("/bookings", "POST", {
        room_id: room,
        start_date: start,
        end_date: end,
        quantity,
        guest_note: guestNote,
      });
      navigate("/bookings?queue=active");
      toast(
        "Request sent. The owner has 24 hours to respond; payment opens after approval.",
      );
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page detail-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} />
        All homes
      </Link>
      <div className="detail-title">
        <div>
          <div className="eyebrow">
            {h.city.toUpperCase()} / {h.area.toUpperCase()}
          </div>
          <h1>{h.name}</h1>
          <p>
            <MapPin size={16} />
            {h.address}
          </p>
        </div>
        <button className="button secondary" onClick={() => toggleSave(h.id)}>
          <Heart
            size={17}
            fill={saved.includes(h.id) ? "currentColor" : "none"}
          />
          {saved.includes(h.id) ? "Saved" : "Save home"}
        </button>
      </div>
      <div className="gallery">
        {h.photos.slice(0, 3).map((p, i) => (
          <button key={i} onClick={() => setPhoto(p)}>
            <img src={p} alt={`${h.name}, photo ${i + 1}`} />
            {i === 2 && (
              <span>
                View photo <Plus size={16} />
              </span>
            )}
          </button>
        ))}
      </div>
      {h.photos.length > 3 && (
        <div className="photo-thumbs">
          {h.photos.slice(3).map((p, i) => (
            <button key={i} onClick={() => setPhoto(p)}>
              <img src={p} alt={`Additional photo ${i + 4}`} />
            </button>
          ))}
        </div>
      )}
      <div className="detail-columns">
        <div>
          <div className="detail-badges">
            <Badge status={h.status}>
              <ShieldCheck size={14} />
              {h.status === "approved" ? "Verified listing" : h.status}
            </Badge>
            <Badge>{h.gender}</Badge>
            <Badge>
              <Star size={14} />
              {h.rating ? h.rating.toFixed(1) : "New listing"} ·{" "}
              {h.review_count} reviews
            </Badge>
          </div>
          <section className="detail-section">
            <h2>A place to feel at home</h2>
            <p>{h.description}</p>
            <div className="host">
              <span className="avatar">{h.owner_name?.[0]}</span>
              <div>
                <b>Hosted by {h.owner_name}</b>
                <small>Hostel owner · {h.owner_plan} plan</small>
              </div>
              <button
                className="text-button"
                onClick={() => (user ? setMessage(true) : navigate("/login"))}
              >
                Contact host <MessageCircle size={17} />
              </button>
            </div>
          </section>
          <section className="detail-section">
            <h2>The everyday essentials</h2>
            <div className="facility-grid">
              {h.facilities.map((f) => (
                <span key={f}>
                  <Icon name={f} size={21} />
                  {f}
                </span>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h2>Room for your routine</h2>
            <p>
              Prices are per bed, per month. Capacity and availability refer to
              beds.
            </p>
            <div className="room-options">
              {h.rooms.map((r) => (
                <label
                  className={`room-option ${room === r.id ? "selected" : ""}`}
                  key={r.id}
                >
                  <input
                    type="radio"
                    name="room"
                    value={r.id}
                    checked={room === r.id}
                    onChange={() => setRoom(r.id)}
                  />
                  <BedDouble size={23} />
                  <div>
                    <b>{r.name}</b>
                    <small>
                      {r.sharing === 1 ? "Private" : `${r.sharing} sharing`} ·{" "}
                      {r.ac ? "AC" : "Non-AC"} · {r.available} beds available
                    </small>
                  </div>
                  <strong>
                    {money(r.rent)}
                    <small>/ month</small>
                  </strong>
                </label>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h2>Your neighbourhood</h2>
            <p>{h.nearby}</p>
            <MapView homes={[h]} />
            <a
              className="text-button"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`}
            >
              Open in Google Maps <ExternalLink size={15} />
            </a>
          </section>
          <section className="detail-section">
            <h2>Good to know</h2>
            <div className="two-col">
              <div>
                <Clock size={20} />
                <h4>Arrival & departure</h4>
                <p>
                  Check-in from {h.check_in}
                  <br />
                  Check-out by {h.check_out}
                </p>
              </div>
              <div>
                <ShieldCheck size={20} />
                <h4>Cancellation & refunds</h4>
                <p>
                  Full refund before move-in or while awaiting owner approval.
                  After move-in, only the deposit is refundable.
                </p>
                <small>House policy: {h.refund_policy}</small>
              </div>
            </div>
            <a className="text-button" href={"tel:" + h.contact}>
              Call the owner: {h.contact}
            </a>
          </section>
          <section className="detail-section">
            <h2>From people who stayed</h2>
            {data.reviews.length ? (
              data.reviews.map((v) => (
                <div className="review" key={v.id}>
                  <b>{v.name}</b>
                  <span>{"★".repeat(v.rating)}</span>
                  <p>{v.body}</p>
                  <small>{dateLabel(v.created_at)}</small>
                </div>
              ))
            ) : (
              <p>
                No reviews yet. Guests can share their experience after moving
                in.
              </p>
            )}
          </section>
        </div>
        <aside className="booking-panel">
          <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
          <p className="booking-price">
            {money(
              r ? Math.round(r.rent * (1 - h.discount / 100)) : h.min_rent,
            )}
            <span> / month</span>
          </p>
          {h.discount > 0 && (
            <Badge status="approved">{h.discount}% rent discount applied</Badge>
          )}
          <div className="two-col date-fields">
            <Field label="Move-in">
              <input
                type="date"
                min={nextDate(0)}
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (e.target.value >= end) {
                    const d = new Date(e.target.value);
                    d.setDate(d.getDate() + 30);
                    setEnd(d.toISOString().slice(0, 10));
                  }
                }}
              />
            </Field>
            <Field label="Move-out">
              <input
                type="date"
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <small>
            Minimum {h.min_stay_days} nights · first month payable after
            approval
          </small>
          <Field label="Number of beds">
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "bed" : "beds"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note to the owner (optional)">
            <textarea
              maxLength={1000}
              value={guestNote}
              onChange={(e) => setGuestNote(e.target.value)}
              placeholder="Arrival time, food preferences or any questions"
            />
          </Field>
          <div className="price-line">
            <span>First month rent · {quantity} bed(s)</span>
            <b>{money(rent)}</b>
          </div>
          <div className="price-line">
            <span>Refundable deposit</span>
            <b>{money(h.deposit * quantity)}</b>
          </div>
          {food > 0 && (
            <div className="price-line">
              <span>Monthly food plan</span>
              <b>{money(food)}</b>
            </div>
          )}
          {services > 0 && (
            <div className="price-line">
              <span>Monthly services</span>
              <b>{money(services)}</b>
            </div>
          )}
          {tax > 0 && (
            <div className="price-line">
              <span>Tax</span>
              <b>{money(tax)}</b>
            </div>
          )}
          <div className="price-line total">
            <span>Due after approval</span>
            <b>{money(total)}</b>
          </div>
          <button
            className="button full"
            disabled={
              busy ||
              !r ||
              r.available < quantity ||
              nights < h.min_stay_days ||
              nights > 366 ||
              !config.demo ||
              h.status !== "approved" ||
              (!!user && user.role !== "user")
            }
            onClick={reserve}
          >
            {busy ? (
              "Reserving…"
            ) : (
              <>
                Request your space
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="booking-note">
            <LockKeyhole size={13} />
            {user && user.role !== "user"
              ? "Use a guest account to book"
              : config.demo
                ? "Demo checkout · no real charge"
                : "Payments currently unavailable"}
          </p>
          <div className="booking-help">
            <Check size={17} />
            <span>
              Owner approval before payment
              <small>
                The owner has 24 hours to respond. Once approved, pay within 24
                hours to confirm your stay.
              </small>
            </span>
          </div>
        </aside>
      </div>
      {photo && (
        <Modal title="A closer look" onClose={() => setPhoto(null)}>
          <img className="full-image" src={photo} alt={h.name} />
        </Modal>
      )}
      {message && (
        <Modal
          title={"Message " + h.owner_name}
          onClose={() => setMessage(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/messages", "POST", {
                  hostel_id: h.id,
                  body: draft,
                });
                setMessage(false);
                toast("Message sent. Replies appear in Messages.");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <Field label="Your message">
              <textarea
                required
                maxLength={2000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about meals, house rules or moving in…"
              />
            </Field>
            <button className="button">
              Send message <ArrowRight size={16} />
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Compare() {
  const { compare, toggleCompare } = useApp();
  const { data, error } = useLoad<{ hostels: Hostel[] }>("/hostels");
  const homes = data?.hostels.filter((h) => compare.includes(h.id)) || [];
  const rows: [string, (h: Hostel) => React.ReactNode][] = [
    ["Location", (h) => `${h.area}, ${h.city}`],
    [
      "Monthly rent",
      (h) => money(Math.round(h.min_rent * (1 - h.discount / 100))),
    ],
    ["Deposit", (h) => money(h.deposit)],
    ["For", (h) => h.gender],
    [
      "Rating",
      (h) => (h.rating ? `${h.rating.toFixed(1)} / 5` : "No reviews yet"),
    ],
    ["Facilities", (h) => h.facilities.join(", ")],
    ["Room types", (h) => h.rooms.map((r) => r.name).join(", ")],
    ["Beds available", (h) => h.available],
    ["Nearby", (h) => h.nearby],
  ];
  return (
    <div className="page">
      <PageTitle
        eyebrow="SIDE BY SIDE"
        title="Find your perfect fit."
        subtitle="Compare up to three homes, with every detail in one place."
      />
      <ErrorBox error={error} />
      {!data ? (
        <Loading />
      ) : homes.length ? (
        <div className="comparison-wrap">
          <div
            className="comparison"
            style={{
              gridTemplateColumns: `150px repeat(${homes.length},minmax(210px,1fr))`,
            }}
          >
            <div />
            {homes.map((h) => (
              <div className="compare-head" key={h.id}>
                <button
                  className="icon-button"
                  onClick={() => toggleCompare(h.id)}
                  aria-label={"Remove " + h.name}
                >
                  <X size={16} />
                </button>
                <img src={h.photos[0]} alt={h.name} />
                <h3>{h.name}</h3>
                <Link className="text-button" to={"/hostels/" + h.id}>
                  View home
                  <ArrowUpRight size={15} />
                </Link>
              </div>
            ))}
            {rows.map(([label, fn]) => (
              <React.Fragment key={label}>
                <strong>{label}</strong>
                {homes.map((h) => (
                  <div key={h.id}>{fn(h)}</div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <Empty
          title="A little comparison helps"
          body="Select ‘Add to compare’ on up to three homes."
        >
          <Link className="button" to="/">
            Find homes
          </Link>
        </Empty>
      )}
    </div>
  );
}
