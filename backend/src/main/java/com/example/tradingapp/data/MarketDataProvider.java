package com.example.tradingapp.data;

import com.example.tradingapp.Candle;
import com.example.tradingapp.Quote;
import java.util.List;

public interface MarketDataProvider {
    Quote getQuote(String providerSymbol) throws Exception;
    List<Candle> getCandles(String providerSymbol, int minutes) throws Exception;
}
