package com.example.tradingapp;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class PortfolioService {
    private final Portfolio portfolio = new Portfolio();
    public synchronized Portfolio get(){ return portfolio; }

    public synchronized String place(Order order, Quote last){
        if (order.quantity <= 0) return "수량이 올바르지 않습니다.";
        double price = order.price > 0 ? order.price : (last!=null?last.price:0);
        if (price <= 0) return "가격 정보 없음 (잠시 후 재시도)";
        double cost = price * order.quantity;
        Position pos = portfolio.positions.get(order.symbol);
        if ("BUY".equalsIgnoreCase(order.side)){
            if (portfolio.cash < cost) return "현금이 부족합니다.";
            if (pos == null) pos = new Position(order.symbol, last.name, 0, 0);
            double newAvg = (pos.avgPrice*pos.quantity + cost) / (pos.quantity + order.quantity);
            pos.quantity += order.quantity; pos.avgPrice = Math.round(newAvg*100.0)/100.0; portfolio.positions.put(order.symbol, pos);
            portfolio.cash -= cost; portfolio.logs.add("매수 " + order.symbol + " " + order.quantity + " @ " + price);
            return "OK";
        } else if ("SELL".equalsIgnoreCase(order.side)){
            if (pos == null || pos.quantity < order.quantity) return "보유 수량이 부족합니다.";
            pos.quantity -= order.quantity; if (pos.quantity==0) portfolio.positions.remove(order.symbol);
            portfolio.cash += cost; portfolio.logs.add("매도 " + order.symbol + " " + order.quantity + " @ " + price);
            return "OK";
        }
        return "알 수 없는 주문입니다.";
    }
}
