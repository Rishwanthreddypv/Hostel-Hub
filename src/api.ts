export type User = {
  id: string;
  name: string;
  email: string;
  role: "user" | "owner" | "admin";
  phone: string;
  bio: string;
  plan: string;
  status: string;
};
export type Room = {
  id: string;
  name: string;
  sharing: number;
  rent: number;
  capacity: number;
  available: number;
  ac: number;
};
export type Hostel = {
  min_stay_days: number;
  food_charge: number;
  service_charge: number;
  tax_percent: number;
  id: string;
  name: string;
  city: string;
  area: string;
  address: string;
  description: string;
  gender: string;
  facilities: string[];
  photos: string[];
  deposit: number;
  discount: number;
  latitude: number;
  longitude: number;
  nearby: string;
  check_in: string;
  check_out: string;
  contact: string;
  refund_policy: string;
  status: string;
  verification_note: string;
  rooms: Room[];
  rating: number;
  review_count: number;
  min_rent: number;
  available: number;
  owner_id: string;
  owner_name: string;
  owner_plan: string;
  distance?: number;
  documents?: { id: string; name: string }[];
};
export async function api(path: string, method = "GET", data?: unknown) {
  const form = data instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: {
      "X-HostelHub-Client": "web",
      ...(!form && data !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: data === undefined ? undefined : form ? data : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
export const dateLabel = (s: string) =>
  new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function nextDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
