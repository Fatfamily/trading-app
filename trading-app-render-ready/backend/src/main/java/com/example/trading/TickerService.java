package com.example.trading;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class TickerService {
    @Autowired private SimpMessagingTemplate broker;
    @Autowired private PriceService priceService;

    public static class Sym {
        String sym, name; long px;
        Sym(String sym, String name, long px) { this.sym=sym; this.name=name; this.px=px; }
    }

    private final List<Sym> symbols = new ArrayList<>(List.of(
        new Sym("005930.KS", "삼성전자", 83000),
        new Sym("000660.KS", "SK하이닉스", 195000),
        new Sym("035420.KS", "NAVER", 170000),
        new Sym("035720.KS", "카카오", 59000),
        new Sym("005380.KS", "현대차", 260000)
    ));

    public List<Quote> currentSymbols() {
        List<Quote> out = new ArrayList<>();
        for (Sym s : symbols) {
            out.add(new Quote(s.sym, s.name, s.px, 0, System.currentTimeMillis()));
        }
        return out;
    }

    // 1초마다 랜덤 워크로 가격 갱신 후 브로드캐스트
    @Scheduled(fixedRate = 1000)
    public void tick() {
        for (Sym s : symbols) {
            long delta = ThreadLocalRandom.current().nextLong(-1500, 1501);
            s.px = Math.max(1000, s.px + delta);
            long vol = ThreadLocalRandom.current().nextLong(1000, 10000);
            priceService.update(s.sym, s.px);
            broker.convertAndSend("/topic/quotes", new Quote(s.sym, s.name, s.px, vol, System.currentTimeMillis()));
        }
    }
}
