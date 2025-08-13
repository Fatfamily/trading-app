package com.example.tradingapp;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class WatchlistService {
    private final Set<String> watch = new LinkedHashSet<>();
    public synchronized java.util.List<String> list(){ return new ArrayList<>(watch); }
    public synchronized void add(String symbol){ watch.add(symbol); }
    public synchronized void remove(String symbol){ watch.remove(symbol); }
}
