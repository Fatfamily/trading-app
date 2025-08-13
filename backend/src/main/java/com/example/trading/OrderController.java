package com.example.trading;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class OrderController {
    @Autowired private PortfolioService portfolio;
    @Autowired private PriceService priceService;
    @Autowired private TickerService tickerService;

    @PostMapping(value = "/order", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> order(@RequestBody Order o) {
        long px = priceService.get(o.symbol);
        if (px <= 0) px = 1000;
        portfolio.applyOrder(o, px);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("ok", true);
        res.put("lastPrice", px);
        res.put("portfolio", portfolio.snapshot(priceService));
        return res;
    }

    @GetMapping("/portfolio")
    public Map<String, Object> portfolio() {
        return portfolio.snapshot(priceService);
    }

    @GetMapping("/symbols")
    public List<Quote> symbols() {
        return tickerService.currentSymbols();
    }
}
