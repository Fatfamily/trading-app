package com.example.tradingapp.data;

import com.example.tradingapp.Candle;
import com.example.tradingapp.Quote;
import java.net.URI;
import java.net.http.*;
import java.util.*;

public class AlphaVantageProvider implements MarketDataProvider {
    private final String apiKey;
    private final HttpClient client = HttpClient.newHttpClient();
    public AlphaVantageProvider(String apiKey){ this.apiKey = apiKey; }

    @Override
    public Quote getQuote(String providerSymbol) throws Exception {
        String url="https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol="+providerSymbol+"&apikey="+apiKey;
        HttpRequest req=HttpRequest.newBuilder(URI.create(url)).GET().build();
        HttpResponse<String> res=client.send(req,HttpResponse.BodyHandlers.ofString());
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        Map<String,Object> json=mapper.readValue(res.body(),Map.class);
        Map<String,String> q=(Map<String,String>)json.getOrDefault("Global Quote", Map.of());
        double price=parseD(q.get("05. price")); double prev=parseD(q.get("08. previous close"));
        double ch=price-prev; double pct=prev!=0?(ch/prev)*100.0:0.0;
        Quote out=new Quote(); out.price=round(price); out.change=round(ch); out.pct=round(pct); out.volume=(long)parseD(q.get("06. volume")); out.ts=System.currentTimeMillis();
        return out;
    }

    @Override
    public List<Candle> getCandles(String providerSymbol, int minutes) throws Exception {
        String url="https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&interval=1min&outputsize=compact&symbol="+providerSymbol+"&apikey="+apiKey;
        HttpRequest req=HttpRequest.newBuilder(URI.create(url)).GET().build();
        HttpResponse<String> res=client.send(req,HttpResponse.BodyHandlers.ofString());
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        Map<String,Object> json=mapper.readValue(res.body(),Map.class);
        Map<String, Map<String,String>> series=(Map<String, Map<String,String>>)json.getOrDefault("Time Series (1min)", Map.of());
        List<Map.Entry<String, Map<String,String>>> entries=new ArrayList<>(series.entrySet());
        entries.sort(Comparator.comparing(Map.Entry::getKey));
        List<Candle> out=new ArrayList<>();
        int keep=Math.min(entries.size(), minutes);
        for (int i=entries.size()-keep;i<entries.size();i++){
            var e=entries.get(i);
            long epoch=parseEpoch(e.getKey());
            var v=e.getValue();
            double o=parseD(v.get("1. open")); double h=parseD(v.get("2. high")); double l=parseD(v.get("3. low")); double c=parseD(v.get("4. close"));
            long vol=(long)parseD(v.get("5. volume"));
            out.add(new Candle(epoch, round(o), round(h), round(l), round(c), vol));
        }
        return out;
    }
    private static double parseD(String s){ try{ return s==null?0.0:Double.parseDouble(s);}catch(Exception e){return 0.0;} }
    private static long parseEpoch(String s){
        try{ java.time.LocalDateTime dt=java.time.LocalDateTime.parse(s, java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
             return dt.toEpochSecond(java.time.ZoneOffset.UTC);}catch(Exception e){ return System.currentTimeMillis()/1000;}
    }
    private static double round(double v){ return Math.round(v*100.0)/100.0; }
}
