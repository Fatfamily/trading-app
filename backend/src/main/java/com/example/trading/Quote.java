package com.example.trading;

public class Quote {
    public String symbol;     // e.g., 005930.KS
    public String name;       // e.g., 삼성전자
    public long price;        // last price
    public long volume;       // volume
    public long ts;           // timestamp

    public Quote() {}
    public Quote(String symbol, String name, long price, long volume, long ts) {
        this.symbol = symbol; this.name = name; this.price = price; this.volume = volume; this.ts = ts;
    }
}
