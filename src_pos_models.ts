// TypeScript models and helper types for POS system
// Can be used in frontend (TSX) or CLI tools

export type ID = string;

export interface Product {
  id: ID;
  sku: string;
  name: string;
  description?: string;
  price: number; // in smallest currency unit e.g. cents
  taxPercent?: number; // e.g. 7.0
  stock: number; // current inventory quantity
  reorderThreshold?: number; // when to alert
  metadata?: Record<string, any>;
}

export interface CartItem {
  productId: ID;
  sku?: string;
  name?: string;
  unitPrice: number;
  quantity: number;
  taxPercent?: number;
  discount?: number; // absolute amount per item
}

export interface Customer {
  id: ID;
  email?: string;
  name?: string;
  phone?: string;
  note?: string;
  metadata?: Record<string, any>;
}

export interface Payment {
  method: "cash" | "card" | "qr" | "wallet" | "other";
  amount: number; // smallest currency unit
  reference?: string; // card txn id, etc.
}

export interface Order {
  id: ID;
  number: string; // e.g. POS-20260123-0001
  createdAt: string; // ISO
  cashierId?: ID;
  customer?: Customer | null;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payments: Payment[];
  status: "pending" | "paid" | "void" | "completed";
  receiptHtml?: string;
  metadata?: Record<string, any>;
}