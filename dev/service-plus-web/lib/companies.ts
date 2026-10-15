"use client";

import { useEffect, useState } from "react";

import { fetchCompanies } from "@/lib/api";
import type { Company } from "@/lib/types";

// One /api/public/companies request per page load, shared by the company dropdowns and the
// spare-parts checks below. A failed request is forgotten, so a retry asks again.
let request: Promise<Company[]> | null = null;

export function loadCompanies(fresh = false): Promise<Company[]> {
  if (fresh || !request) {
    request = fetchCompanies().catch((error: unknown) => {
      request = null;
      throw error;
    });
  }
  return request;
}

/**
 * Whether any company has Spare Parts Web switched on (Service+ Super Admin → Clients →
 * Features). null while loading. Every spare-parts entry point — menu item, hero button,
 * page — stays hidden until this is true, so a site with no catalogues never offers one.
 */
export function usePartsAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    loadCompanies()
      .then((companies) => active && setAvailable(companies.some((c) => c.partsEnabled)))
      .catch(() => active && setAvailable(false));
    return () => {
      active = false;
    };
  }, []);

  return available;
}
