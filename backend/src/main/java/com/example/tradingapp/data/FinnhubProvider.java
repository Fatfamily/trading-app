package com.example.tradingapp.data;

import com.example.tradingapp.Candle;
import com.example.tradingapp.Quote;
import java.net.URI;
import java.net.http.*;
import java.time.Instant;
import java.util.*;

public class FinnhubProvider implements MarketDataProvider {
    private final String apiKey;
    private final HttpClient client = HttpClient.newHttpClient();
    public FinnhubProvider(String apiKey){ this.apiKey = apiKey; }

    @Override
    public Quote getQuote(String providerSymbol) throws Exception {
        String url = "https://finnhub.io/api/v1/quote?symbol=" + providerSymbol + "&token=" + apiKey;
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).GET().build();
        HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        Map<String, Object> json = mapper.readValue(res.body(), Map.class);
        double c = asD(json.get("c"));
        double d = asD(json.get("d"));
        double dp = asD(json.get("dp"));
        long ts = (long) (asD(json.getOrDefault("t", (double)(System.currentTimeMillis()/1000))) * 1000L);
        Quote q = new Quote();
        q.price = round(c); q.change = round(d); q.pct = round(dp); q.volume = 0L; q.ts = ts;
        return q;
    }

    @Override
    public List<Candle> getCandles(String providerSymbol, int minutes) throws Exception {
        long to = Instant.now().getEpochSecond();
        long from = to - minutes * 60L;
        String url = "https://finnhub.io/api/v1/stock/candle?symbol="+providerSymbol+"&resolution=1&from="+from+"&to="+to+"&token="+apiKey;
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).GET().build();
        HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        Map<String,Object> json = mapper.readValue(res.body(), Map.class);
        if (!"ok".equals(String.valueOf(json.get("s")))) return List.of();
        var t=(java.util.List<?>)json.get("t"); var o=(java.util.List<?>)json.get("o");
        var h=(java.util.List<?>)json.get("h"); var l=(java.util.List<?>)json.get("l");
        var c=(java.util.List<?>)json.get("c"); var v=(java.util.List<?>)json.get("v");
        List<Candle> out = new ArrayList<>();
        for (int i=0;i<t.size();i++){
            long ts=((Number)t.get(i)).longValue();
            out.add(new Candle(ts, round(asD(o.get(i))), round(asD(h.get(i))), round(asD(l.get(i))), round(asD(c.get(i))), ((Number)v.get(i)).longValue()));
        }
        return out;
    }
    private static double asD(Object x){ return x==null?0.0:((Number)x).doubleValue(); }
    private static double round(double v){ return Math.round(v*100.0)/100.0; }
}
