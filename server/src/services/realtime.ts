import { Response } from "express";

interface ConnectedClient {
  res: Response;
  userId: string;
}

const orgClients = new Map<string, Set<ConnectedClient>>();

export function registerClient(
  organizationId: string,
  userId: string,
  res: Response
): void {
  if (!orgClients.has(organizationId)) {
    orgClients.set(organizationId, new Set());
  }

  const client: ConnectedClient = { res, userId };
  orgClients.get(organizationId)!.add(client);

  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, organizationId })}\n\n`);

  res.on("close", () => {
    const clients = orgClients.get(organizationId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        orgClients.delete(organizationId);
      }
    }
  });
}

export function broadcastOrgEvent(
  organizationId: string,
  event: string,
  data: any
): void {
  const clients = orgClients.get(organizationId);
  if (!clients || clients.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch {
      // Client disconnected or write failed
      clients.delete(client);
    }
  }
}
