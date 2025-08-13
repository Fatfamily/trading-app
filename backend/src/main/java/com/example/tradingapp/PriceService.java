package com.example.tradingapp;

import com.example.tradingapp.data.*;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PriceService {
    private MarketDataProvider provider;
    private final Map<String, Quote> cache = new ConcurrentHashMap<>();
    private final Map<String, Long> lastFetch = new ConcurrentHashMap<>();
    private static final long STALE_MS = 12_000;

    @PostConstruct
    public void init(){
        String prov = System.getenv().getOrDefault("MARKET_DATA_PROVIDER","FINNHUB").toUpperCase(Locale.ROOT);
        if ("ALPHAVANTAGE".equals(prov)){
            String key = System.getenv("ALPHA_VANTAGE_KEY"); this.provider = new AlphaVantageProvider(key==null?"":key);
        } else {
            String key = System.getenv("FINNHUB_API_KEY"); this.provider = new FinnhubProvider(key==null?"":key);
        }
        long now = System.currentTimeMillis();
        for (Symbols.SymbolInfo s : Symbols.top10()){
            cache.put(s.symbol, new Quote(s.symbol, s.name, 0,0,0,0, now));
            lastFetch.put(s.symbol, 0L);
        }
    }

    public List<Quote> quotesOf(List<String> displaySymbols){
        long now = System.currentTimeMillis();
        List<Quote> out = new ArrayList<>();
        for (String disp : displaySymbols){
            Quote q = cache.get(disp);
            if (q == null){
                Optional<Symbols.SymbolInfo> info = Symbols.byDisplay(disp);
                info.ifPresent(s -> { cache.put(s.symbol, new Quote(s.symbol, s.name,0,0,0,0,now)); lastFetch.put(s.symbol, 0L); });
                q = cache.get(disp);
            }
            if (q != null){ ensureFresh(disp); out.add(cache.get(disp)); }
        }
        return out;
    }

    public List<Quote> top10(){
        List<String> syms = new ArrayList<>();
        for (Symbols.SymbolInfo s : Symbols.top10()) syms.add(s.symbol);
        return quotesOf(syms);
    }

    public void ensureFresh(String displaySymbol){
        long now = System.currentTimeMillis();
        long last = lastFetch.getOrDefault(displaySymbol, 0L);
        if (now - last < STALE_MS) return;
        Optional<Symbols.SymbolInfo> info = Symbols.byDisplay(displaySymbol);
        if (info.isEmpty()) return;
        Symbols.SymbolInfo s = info.get();
        try{
            Quote p = provider.getQuote(s.provider);
            Quote merged = new Quote(s.symbol, s.name, p.price, p.change, p.pct, p.volume, now);
            cache.put(s.symbol, merged);
        }catch(Exception e){}
        finally{ lastFetch.put(displaySymbol, now); }
    }
}
