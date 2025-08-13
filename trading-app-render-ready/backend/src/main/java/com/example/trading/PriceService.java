package com.example.trading;

import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class PriceService {
    private final ConcurrentMap<String, Long> last = new ConcurrentHashMap<>();

    public void update(String symbol, long price) {
        last.put(symbol, price);
    }

    public long get(String symbol) {
        return last.getOrDefault(symbol, 0L);
    }
}
