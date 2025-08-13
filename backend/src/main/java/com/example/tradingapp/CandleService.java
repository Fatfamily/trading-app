package com.example.tradingapp;

import com.example.tradingapp.data.*;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class CandleService {
    private final MarketDataProvider provider;
    public CandleService(){
        String prov = System.getenv().getOrDefault("MARKET_DATA_PROVIDER","FINNHUB").toUpperCase(Locale.ROOT);
        if ("ALPHAVANTAGE".equals(prov)){
            this.provider = new AlphaVantageProvider(System.getenv("ALPHA_VANTAGE_KEY")==null?"":System.getenv("ALPHA_VANTAGE_KEY"));
        } else {
            this.provider = new FinnhubProvider(System.getenv("FINNHUB_API_KEY")==null?"":System.getenv("FINNHUB_API_KEY"));
        }
    }
    public List<Candle> getRecent(String displaySymbol, int minutes){
        Optional<Symbols.SymbolInfo> info = Symbols.byDisplay(displaySymbol);
        if (info.isEmpty()) return List.of();
        try{ return provider.getCandles(info.get().provider, minutes);}catch(Exception e){ return List.of();}
    }
}
