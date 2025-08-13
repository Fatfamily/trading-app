package com.example.tradingapp;
public class Position { public String symbol; public String name; public int quantity; public double avgPrice;
    public Position(){}
    public Position(String symbol, String name, int quantity, double avgPrice){
        this.symbol=symbol; this.name=name; this.quantity=quantity; this.avgPrice=avgPrice; }
}
