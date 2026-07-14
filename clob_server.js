import { WebSocketServer } from 'ws';

export class CentralLimitOrderBook {
  constructor() {
    this.bids = []; // [{ id, price, size, timestamp }] - sorted desc price, asc timestamp
    this.asks = []; // [{ id, price, size, timestamp }] - sorted asc price, asc timestamp
    this.trades = []; // Match execution events
  }

  // Add Buy order to book
  addBid(bid) {
    this.bids.push(bid);
    this.sortBids();
    this.matchOrders();
  }

  // Add Sell order to book
  addAsk(ask) {
    this.asks.push(ask);
    this.sortAsks();
    this.matchOrders();
  }

  sortBids() {
    this.bids.sort((a, b) => {
      if (b.price !== a.price) {
        return b.price - a.price; // Descending by price
      }
      return a.timestamp - b.timestamp; // Ascending by arrival timestamp
    });
  }

  sortAsks() {
    this.asks.sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price; // Ascending by price
      }
      return a.timestamp - b.timestamp; // Ascending by arrival timestamp
    });
  }

  // Price-Time priority matching logic
  matchOrders() {
    while (this.bids.length > 0 && this.asks.length > 0) {
      const highestBid = this.bids[0];
      const lowestAsk = this.asks[0];

      // Match check: Bid Price >= Ask Price
      if (highestBid.price >= lowestAsk.price) {
        const matchSize = Math.min(highestBid.size, lowestAsk.size);
        const matchPrice = lowestAsk.price; // Limit price of the resting order

        console.log(`[CLOB Matching] MATCH: Bid (${highestBid.id}) matched Ask (${lowestAsk.id}) - Price: $${matchPrice}, Size: ${matchSize}`);

        this.trades.push({
          timestamp: new Date(),
          price: matchPrice,
          size: matchSize,
          bidId: highestBid.id,
          askId: lowestAsk.id
        });

        // Deduct sizes
        highestBid.size -= matchSize;
        lowestAsk.size -= matchSize;

        // Prune filled orders
        if (highestBid.size === 0) this.bids.shift();
        if (lowestAsk.size === 0) this.asks.shift();
      } else {
        break; // No crossing possible
      }
    }
  }

  // Retrieve L2 Depth
  getL2Depth() {
    // Group sizes by price point
    const aggregate = (list) => {
      const groups = {};
      list.forEach(o => {
        if (!groups[o.price]) groups[o.price] = 0;
        groups[o.price] += o.size;
      });
      return Object.entries(groups).map(([price, size]) => [parseFloat(price), size]);
    };

    return {
      bids: aggregate(this.bids),
      asks: aggregate(this.asks)
    };
  }
}

// WebSocket server setup
export function startWebSocketClobServer(port = 3399) {
  const wss = new WebSocketServer({ port });
  const book = new CentralLimitOrderBook();
  
  console.log(`⚡ [WebSocket CLOB] Gateway server online on port ${port}`);

  wss.on('connection', (ws) => {
    console.log('[WebSocket CLOB] Client connected');
    
    // Send initial book snapshot
    ws.send(JSON.stringify({
      event: 'book_snapshot',
      data: book.getL2Depth()
    }));

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message);
        if (payload.action === 'limit_order') {
          const price = parseFloat(payload.price);
          const size = parseInt(payload.size);
          const side = payload.side;
          const marketId = payload.marketId;

          if (isNaN(price) || price < 0.01 || price > 0.99 ||
              isNaN(size) || size <= 0 ||
              (side !== 'BUY' && side !== 'SELL') ||
              !marketId) {
            
            ws.send(JSON.stringify({
              event: 'error',
              message: 'Invalid order parameters. Price must be [0.01, 0.99], size must be > 0, side must be BUY/SELL, and marketId must be provided.'
            }));
            return;
          }

          const order = {
            id: `ord_${Math.floor(Math.random() * 100000)}`,
            price,
            size,
            timestamp: Date.now()
          };

          if (side === 'BUY') {
            book.addBid(order);
          } else {
            book.addAsk(order);
          }

          // Broadcast L2 book update to all clients
          const updateMsg = JSON.stringify({
            event: 'book_update',
            market_id: payload.marketId,
            bids: book.getL2Depth().bids,
            asks: book.getL2Depth().asks,
            trades: book.trades
          });

          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              client.send(updateMsg);
            }
          });
        }
      } catch (err) {
        console.error('[WebSocket CLOB] Failed to parse socket message:', err.message);
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket CLOB] Client disconnected');
    });
  });

  return { wss, book };
}

// Run stand-alone if invoked directly
if (process.argv[1] && process.argv[1].endsWith('clob_server.js')) {
  startWebSocketClobServer();
}
