package com.example.tradingapp;

public class Quote {
    public String symbol;
    public String name;
    public double price;
    public double change;
    public double pct;
    public long volume;
    public long ts;
    public Quote(){}
    public Quote(String symbol, String name, double price, double change, double pct, long volume, long ts){
        this.symbol=symbol; this.name=name; this.price=price; this.change=change; this.pct=pct; this.volume=volume; this.ts=ts;
    }
}
