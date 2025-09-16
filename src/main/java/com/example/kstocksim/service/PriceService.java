package com.example.kstocksim.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Random;

@Service
public class PriceService {

    // Return deterministic pseudo-random price for a given code to allow testing without external API.
    public BigDecimal getPrice(String code) {
        // Seed with code hash + minute to have slightly changing price
        long minute = Instant.now().getEpochSecond() / 60;
        long seed = code.hashCode() ^ minute;
        Random r = new Random(seed);
        int base = Math.abs(code.hashCode()) % 50000 + 1000; // base price
        int tick = r.nextInt(200) - 100;
        long p = Math.max(100, base + tick);
        // round to nearest 10
        p = Math.round(p / 10.0) * 10;
        return BigDecimal.valueOf(p);
    }
}
