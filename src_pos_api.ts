// Minimal TypeScript API client for the POS backend
// Use in browser/React to talk to server endpoints (Flask / NestJS / etc.)

const BASE = (window as any).__POS_API_BASE__ || "";

function jsonFetch(input: RequestInfo, init?: RequestInit) {
  return fetch(BASE + String(input), {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  }).then(async (r) => {
    const text = await r.text();
    if (!r.ok) throw new Error(text || r.statusText);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  });
}

export async function getProducts() {
  return jsonFetch("/api/products");
}

export async function getProduct(id: string) {
  return jsonFetch(`/api/products/${id}`);
}

export async function createProduct(payload: any) {
  return jsonFetch("/api/products", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateProduct(id: string, payload: any) {
  return jsonFetch(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function listCustomers() {
  return jsonFetch("/api/customers");
}

export async function createCustomer(payload: any) {
  return jsonFetch("/api/customers", { method: "POST", body: JSON.stringify(payload) });
}

export async function createOrder(order: Partial<any>) {
  return jsonFetch("/api/orders", { method: "POST", body: JSON.stringify(order) });
}

export async function getOrderReceipt(id: string) {
  // returns HTML string (receipt)
  return fetch(`/api/orders/${id}/receipt`, { credentials: "same-origin" }).then((r) => r.text());
}

export async function getTopProducts(limit = 10) {
  return jsonFetch(`/api/analytics/top-products?limit=${limit}`);
}

export async function getStockAlerts(threshold = 5) {
  return jsonFetch(`/api/stock-alerts?threshold=${threshold}`);
}