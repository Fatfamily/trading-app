package com.example.tradingapp;

import java.util.*;

public class Symbols {
    public static class SymbolInfo {
        public final String symbol;     // display e.g., 005930
        public final String provider;   // e.g., 005930.KS
        public final String name;
        public final String market;
        public SymbolInfo(String symbol, String provider, String name, String market){
            this.symbol=symbol; this.provider=provider; this.name=name; this.market=market;
        }
    }

    public static final List<SymbolInfo> ALL = List.of(
        new SymbolInfo("005930","005930.KS","삼성전자","KOSPI"),
        new SymbolInfo("000660","000660.KS","SK하이닉스","KOSPI"),
        new SymbolInfo("035420","035420.KS","NAVER","KOSPI"),
        new SymbolInfo("035720","035720.KS","카카오","KOSPI"),
        new SymbolInfo("051910","051910.KS","LG화학","KOSPI"),
        new SymbolInfo("068270","068270.KS","셀트리온","KOSPI"),
        new SymbolInfo("207940","207940.KS","삼성바이오로직스","KOSPI"),
        new SymbolInfo("005380","005380.KS","현대차","KOSPI"),
        new SymbolInfo("105560","105560.KS","KB금융","KOSPI"),
        new SymbolInfo("066570","066570.KS","LG전자","KOSPI"),
        new SymbolInfo("086520","086520.KQ","에코프로","KOSDAQ"),
        new SymbolInfo("051900","051900.KS","LG생활건강","KOSPI"),
        new SymbolInfo("028260","028260.KS","삼성물산","KOSPI"),
        new SymbolInfo("034730","034730.KS","SK","KOSPI"),
        new SymbolInfo("259960","259960.KS","크래프톤","KOSPI"),
        new SymbolInfo("373220","373220.KS","LG에너지솔루션","KOSPI")
    );

    public static List<SymbolInfo> top10(){ return ALL.subList(0, Math.min(10, ALL.size())); }

    public static Optional<SymbolInfo> byDisplay(String display){
        for (SymbolInfo s : ALL) if (s.symbol.equalsIgnoreCase(display)) return Optional.of(s);
        return Optional.empty();
    }

    public static List<SymbolInfo> search(String q){
        String qq = q.toLowerCase(Locale.ROOT);
        List<SymbolInfo> out = new ArrayList<>();
        for (SymbolInfo s : ALL){
            if (s.symbol.contains(q) || s.name.toLowerCase(Locale.ROOT).contains(qq)) out.add(s);
        }
        return out;
    }
}
