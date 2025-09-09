package com.example.kstocksim.service;

import com.example.kstocksim.util.PriceUtil;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PriceService {

    private final NaverClient naverClient;

    public PriceService(NaverClient naverClient) {
        this.naverClient = naverClient;
    }

    private static class Quote {
        BigDecimal price;
        Instant updatedAt;
        Instant lastRealFetch;
    }

    private final Map<String, Quote> cache = new ConcurrentHashMap<>();

    public BigDecimal getPrice(String code) {
        Quote q = cache.computeIfAbsent(code, k -> new Quote());
        Instant now = Instant.now();

        boolean needRealFetch = q.lastRealFetch == null || now.minusSeconds(2).isAfter(q.lastRealFetch);
        if (needRealFetch) {
            naverClient.fetchCurrentPrice(code).ifPresentOrElse(p -> {
                q.price = p;
                q.updatedAt = now;
                q.lastRealFetch = now;
            }, () -> {
                // no update from remote; simulate
                q.price = PriceUtil.randomWalk(q.price);
                q.updatedAt = now;
            });
        } else {
            // within 2s window, simulate micro-ticks
            q.price = PriceUtil.randomWalk(q.price);
            q.updatedAt = now;
        }
        if (q.price == null) q.price = BigDecimal.valueOf(1000);
        return q.price;
    }
}
