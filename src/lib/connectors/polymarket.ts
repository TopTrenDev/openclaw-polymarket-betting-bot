import { Chain, ClobClient } from "@polymarket/clob-client-v2";
import { MarketTick, WhaleFlow } from "../types/index.js";

type GammaMarket = {
  id: string;
  slug?: string;
  question?: string;
  endDate?: string;
  closed?: boolean;
  active?: boolean;
  lastTradePrice?: number;
  bestBid?: number;
  bestAsk?: number;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  conditionId?: string;
};

type DataTrade = {
  proxyWallet?: string;
  side?: "BUY" | "SELL";
  size?: number;
  price?: number;
  timestamp?: number;
  slug?: string;
  eventSlug?: string;
  title?: string;
  outcome?: string;
};

export type PolymarketConnectorOptions = {
  gammaBaseUrl: string;
  clobHost: string;
  dataApiBase: string;
  chainId?: number;
  marketSlug?: string;
  marketId?: string;
};

export class PolymarketConnector {
  private selectedMarket: GammaMarket | null = null;
  private selectedSlug: string | null = null;
  private yesTokenId: string | null = null;
  private history: MarketTick[] = [];
  private readonly clob: ClobClient;

  constructor(private readonly options: PolymarketConnectorOptions) {
    this.clob = new ClobClient({
      host: options.clobHost,
      chain: (options.chainId ?? Chain.POLYGON) as Chain,
      throwOnError: false
    });
  }

  async getMarketTicks(limit = 15): Promise<MarketTick[]> {
    const market = await this.resolveMarket();
    const yes = await this.deriveYesPrice(market);

    this.history.push({
      marketId: market.slug || market.id,
      yesPrice: yes,
      noPrice: clamp01(1 - yes),
      ts: Date.now()
    });

    if (this.history.length > 300) this.history.shift();
    return this.history.slice(-limit);
  }

  async getWhaleFlow(marketId: string): Promise<WhaleFlow> {
    const slug = this.selectedSlug ?? marketId;
    const trades = await this.fetchRecentTrades(400);
    const marketTrades = trades.filter((t) => (t.eventSlug || t.slug) === slug);

    const byWallet = new Map<string, { netYes: number; gross: number }>();

    for (const t of marketTrades) {
      const wallet = (t.proxyWallet || "anon").toLowerCase();
      const notional = Math.max(0, Number(t.size ?? 0) * Number(t.price ?? 0));
      if (!notional) continue;

      const outcome = (t.outcome || "").toLowerCase();
      const side = (t.side || "BUY").toUpperCase();
      const isYesOutcome = outcome === "up" || outcome === "yes";

      let signed = 0;
      if (isYesOutcome) signed = side === "BUY" ? notional : -notional;
      else signed = side === "BUY" ? -notional : notional;

      const prev = byWallet.get(wallet) || { netYes: 0, gross: 0 };
      prev.netYes += signed;
      prev.gross += notional;
      byWallet.set(wallet, prev);
    }

    const whales = [...byWallet.entries()]
      .map(([wallet, w]) => ({ wallet, ...w }))
      .filter((w) => w.gross >= 200)
      .sort((a, b) => b.gross - a.gross);

    const netYesNotional = whales.reduce((s, w) => s + w.netYes, 0);
    const grossNotional = whales.reduce((s, w) => s + w.gross, 0);

    return {
      marketId,
      netYesNotional,
      grossNotional,
      tradeCount: marketTrades.length,
      ts: Date.now(),
      topWallets: whales.slice(0, 8).map((w) => ({
        wallet: w.wallet,
        netYes: w.netYes,
        gross: w.gross
      }))
    };
  }

  private async resolveMarket(): Promise<GammaMarket> {
    if (this.selectedMarket && !this.selectedMarket.closed) return this.selectedMarket;

    const { gammaBaseUrl, marketSlug, marketId } = this.options;

    if (marketSlug) {
      const arr = await this.fetchJson<GammaMarket[]>(
        `${gammaBaseUrl}/markets?slug=${encodeURIComponent(marketSlug)}`
      );
      if (arr.length) return this.cacheMarket(arr[0], arr[0].slug || marketSlug);
    }

    if (marketId) {
      const arr = await this.fetchJson<GammaMarket[]>(
        `${gammaBaseUrl}/markets?id=${encodeURIComponent(marketId)}`
      );
      if (arr.length) return this.cacheMarket(arr[0], arr[0].slug || null);
    }

    const recentTrades = await this.fetchRecentTrades(300);
    const btc5m = recentTrades.find((t) => (t.eventSlug || "").startsWith("btc-updown-5m-"));
    if (btc5m?.eventSlug) {
      const arr = await this.fetchJson<GammaMarket[]>(
        `${gammaBaseUrl}/markets?slug=${encodeURIComponent(btc5m.eventSlug)}`
      );
      if (arr.length) return this.cacheMarket(arr[0], arr[0].slug || btc5m.eventSlug);
    }

    const all = await this.fetchJson<GammaMarket[]>(
      `${gammaBaseUrl}/markets?closed=false&active=true&limit=1000&offset=500`
    );
    const candidates = all.filter((m) => {
      const q = `${m.question || ""} ${m.slug || ""}`.toLowerCase();
      return (q.includes("bitcoin") || q.includes("btc")) && q.includes("up or down");
    });

    if (!candidates.length) {
      throw new Error("No active BTC up/down market found. Set POLYMARKET_MARKET_SLUG manually.");
    }

    candidates.sort((a, b) => new Date(a.endDate || 0).getTime() - new Date(b.endDate || 0).getTime());
    return this.cacheMarket(candidates[0], candidates[0].slug || null);
  }

  private cacheMarket(market: GammaMarket, slug: string | null): GammaMarket {
    this.selectedMarket = market;
    this.selectedSlug = slug;
    this.yesTokenId = this.resolveYesTokenId(market);
    return market;
  }

  private resolveYesTokenId(market: GammaMarket): string | null {
    const outcomes = parseJsonArray(market.outcomes).map((o) => `${o}`.toLowerCase());
    const tokenIds = parseJsonArray(market.clobTokenIds).map(String);
    if (!tokenIds.length) return null;

    const idx = outcomes.findIndex((o) => o === "up" || o === "yes");
    if (idx >= 0 && tokenIds[idx]) return tokenIds[idx];
    return tokenIds[0] ?? null;
  }

  private async deriveYesPrice(market: GammaMarket): Promise<number> {
    const tokenId = this.yesTokenId ?? this.resolveYesTokenId(market);
    if (tokenId) {
      const clobPrice = await this.fetchClobMidpoint(tokenId);
      if (clobPrice !== null) return clobPrice;
    }

    return this.deriveYesPriceFromGamma(market);
  }

  private async fetchClobMidpoint(tokenId: string): Promise<number | null> {
    const res = await this.clob.getMidpoint(tokenId);
    if (!res || typeof res !== "object" || "error" in res) return null;

    const price = Number((res as { mid?: string }).mid ?? NaN);
    if (Number.isFinite(price) && price > 0 && price < 1) return clamp01(price);
    return null;
  }

  private deriveYesPriceFromGamma(m: GammaMarket): number {
    const outcomes = parseJsonArray(m.outcomes);
    const prices = parseJsonArray(m.outcomePrices).map(Number);
    if (outcomes.length === prices.length && outcomes.length >= 2) {
      const idx = outcomes.findIndex((o) => `${o}`.toLowerCase() === "up" || `${o}`.toLowerCase() === "yes");
      if (idx >= 0 && Number.isFinite(prices[idx])) return clamp01(prices[idx]);
    }

    const last = Number(m.lastTradePrice ?? NaN);
    const bid = Number(m.bestBid ?? NaN);
    const ask = Number(m.bestAsk ?? NaN);

    if (Number.isFinite(last) && last > 0 && last < 1) return clamp01(last);
    if (Number.isFinite(bid) && Number.isFinite(ask) && bid >= 0 && ask <= 1 && ask >= bid) {
      return clamp01((bid + ask) / 2);
    }
    return 0.5;
  }

  private async fetchRecentTrades(limit = 200): Promise<DataTrade[]> {
    const res = await fetch(`${this.options.dataApiBase}/trades?limit=${limit}`);
    if (!res.ok) return [];
    return (await res.json()) as DataTrade[];
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gamma API error ${res.status}: ${url}`);
    return (await res.json()) as T;
  }
}

function parseJsonArray(v?: string): any[] {
  if (!v) return [];
  try {
    const out = JSON.parse(v);
    return Array.isArray(out) ? out : [];
  } catch {
    return [];
  }
}

function clamp01(v: number) {
  return Math.max(0.01, Math.min(0.99, v));
}
