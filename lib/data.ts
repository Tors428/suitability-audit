// Server-only data accessors. Reads the generated JSON files. Cached per
// process via module-level memoization (Next dev mode will still re-evaluate
// on file change because tsx is fresh-required, which is fine).

import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import type { Client, Product, Receipt, AuditReport } from "./types";

let _clients: Client[] | null = null;
let _products: Product[] | null = null;
let _receipts: Receipt[] | null = null;
let _audit: AuditReport | null = null;

const root = process.cwd();

export async function getClients(): Promise<Client[]> {
  if (_clients) return _clients;
  _clients = JSON.parse(
    await fs.readFile(resolve(root, "data", "clients.json"), "utf-8"),
  );
  return _clients!;
}

export async function getProducts(): Promise<Product[]> {
  if (_products) return _products;
  _products = JSON.parse(
    await fs.readFile(resolve(root, "data", "products.json"), "utf-8"),
  );
  return _products!;
}

export async function getReceipts(): Promise<Receipt[]> {
  if (_receipts) return _receipts;
  _receipts = JSON.parse(
    await fs.readFile(resolve(root, "data", "receipts.json"), "utf-8"),
  );
  return _receipts!;
}

export async function getAudit(): Promise<AuditReport> {
  if (_audit) return _audit;
  _audit = JSON.parse(
    await fs.readFile(resolve(root, "data", "audit.json"), "utf-8"),
  );
  return _audit!;
}

export async function getClientById(id: string): Promise<Client | null> {
  const clients = await getClients();
  return clients.find((c) => c.id === id) ?? null;
}

export async function getReceiptById(id: string): Promise<Receipt | null> {
  const receipts = await getReceipts();
  return receipts.find((r) => r.receipt_id === id) ?? null;
}

export async function getProductById(id: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find((p) => p.id === id) ?? null;
}
