package com.example.tradingapp;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

@RestController @RequestMapping("/api") @CrossOrigin(origins="*")
public class ApiController {
    private final PriceService priceService; private final CandleService candleService; private final PortfolioService portfolioService; private final WatchlistService watchlistService;
    public ApiController(PriceService p, CandleService c, PortfolioService pf, WatchlistService wl){ this.priceService=p; this.candleService=c; this.portfolioService=pf; this.watchlistService=wl; }

    @GetMapping("/top10") public List<Quote> top10(){ return priceService.top10(); }
    @GetMapping("/search") public List<Symbols.SymbolInfo> search(@RequestParam String q){ if (q==null||q.isBlank()) return List.of(); return Symbols.search(q); }

    @GetMapping(value="/stream/prices", produces=MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam String symbols){
        SseEmitter emitter = new SseEmitter(0L);
        List<String> syms = Arrays.asList(symbols.split(","));
        ExecutorService es = Executors.newSingleThreadExecutor();
        es.submit(()->{
            try{
                while(true){
                    List<Quote> qs = priceService.quotesOf(syms);
                    Map<String,Object> payload = new HashMap<>();
                    payload.put("type","quotes"); payload.put("ts", Instant.now().toEpochMilli()); payload.put("data", qs);
                    emitter.send(SseEmitter.event().name("quotes").data(payload));
                    Thread.sleep(1000);
                }
            }catch(Exception e){ emitter.complete(); }
        });
        emitter.onCompletion(es::shutdown); emitter.onTimeout(es::shutdown); return emitter;
    }

    @GetMapping("/candles") public List<Candle> candles(@RequestParam String symbol, @RequestParam(defaultValue="120") int minutes){ return candleService.getRecent(symbol, minutes); }

    @GetMapping("/watchlist") public List<String> listWatch(){ return watchlistService.list(); }
    @PostMapping("/watchlist/{symbol}") public void addWatch(@PathVariable String symbol){ watchlistService.add(symbol); }
    @DeleteMapping("/watchlist/{symbol}") public void delWatch(@PathVariable String symbol){ watchlistService.remove(symbol); }

    @GetMapping("/portfolio") public Portfolio portfolio(){ return portfolioService.get(); }
    @PostMapping("/order") public Map<String,String> order(@RequestBody Order order){
        List<Quote> qs = priceService.quotesOf(List.of(order.symbol));
        Quote last = qs.isEmpty()? null : qs.get(0);
        String res = portfolioService.place(order, last);
        return Map.of("result", res);
    }
}
