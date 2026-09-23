export type OrderStatus = 'unpaid' | 'charging' | 'paid';

export interface Deps {
  getStatus: (orderId: string) => Promise<OrderStatus>;
  chargeCard: (orderId: string) => Promise<void>;
  setStatus: (orderId: string, status: OrderStatus) => Promise<void>;
}

export async function handleOrderConfirmed(orderId: string, deps: Deps): Promise<void> {
  const status = await deps.getStatus(orderId);
  if (status === 'unpaid') {
    await deps.chargeCard(orderId);
    await deps.setStatus(orderId, 'paid');
  }
}

export interface FixedDeps {
  claimOrder: (orderId: string) => Promise<boolean>;
  chargeCard: (orderId: string) => Promise<void>;
  setStatus: (orderId: string, status: OrderStatus) => Promise<void>;
}

export async function handleOrderConfirmedFixed(orderId: string, deps: FixedDeps): Promise<void> {
  const claimed = await deps.claimOrder(orderId);
  if (claimed) {
    await deps.chargeCard(orderId);
    await deps.setStatus(orderId, 'paid');
  }
}
