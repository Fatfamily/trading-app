package com.example.trading;

import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class PortfolioService {
    private final Map<String, Integer> holdings = new HashMap<>();
    private final List<String> logs = new ArrayList<>();
    private long cash = 1_000_000L;

    public synchronized Map<String, Object> snapshot(PriceService priceService) {
        long equity = 0L;
        Map<String, Integer> hcopy = new LinkedHashMap<>(holdings);
        for (Map.Entry<String, Integer> e : hcopy.entrySet()) {
            long px = priceService.get(e.getKey());
            equity += px * e.getValue();
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cash", cash);
        m.put("holdings", hcopy);
        m.put("equity", equity);
        m.put("total", cash + equity);
        m.put("logs", new ArrayList<>(logs));
        return m;
    }

    public synchronized void applyOrder(Order o, long lastPrice) {
        int q = Math.max(1, o.qty);
        if ("BUY".equalsIgnoreCase(o.side)) {
            long cost = lastPrice * q;
            if (cash >= cost) {
                cash -= cost;
                holdings.merge(o.symbol, q, Integer::sum);
                logs.add(String.format("BUY %s %d @%d", o.symbol, q, lastPrice));
            } else {
                logs.add("BUY FAIL (insufficient cash)");
            }
        } else if ("SELL".equalsIgnoreCase(o.side)) {
            int pos = holdings.getOrDefault(o.symbol, 0);
            if (pos >= q) {
                holdings.put(o.symbol, pos - q);
                cash += lastPrice * q;
                logs.add(String.format("SELL %s %d @%d", o.symbol, q, lastPrice));
            } else {
                logs.add("SELL FAIL (insufficient position)");
            }
        }
        if (logs.size() > 300) logs.remove(0);
    }
}
