package com.example.tradingapp;

public class Candle {
    public long time; public double open; public double high; public double low; public double close; public long volume;
    public Candle(){}
    public Candle(long time, double open, double high, double low, double close, long volume){
        this.time=time; this.open=open; this.high=high; this.low=low; this.close=close; this.volume=volume;
    }
}
