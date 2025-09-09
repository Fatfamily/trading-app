package com.example.kstocksim.service;

import com.example.kstocksim.model.Order;
import com.example.kstocksim.model.Position;
import com.example.kstocksim.model.Wallet;
import com.example.kstocksim.repo.OrderRepository;
import com.example.kstocksim.repo.PositionRepository;
import com.example.kstocksim.repo.WalletRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SimEngine {

    private final PositionRepository positionRepository;
    private final OrderRepository orderRepository;
    private final WalletRepository walletRepository;
    private final PriceService priceService;

    public SimEngine(PositionRepository positionRepository, OrderRepository orderRepository, WalletRepository walletRepository, PriceService priceService) {
        this.positionRepository = positionRepository;
        this.orderRepository = orderRepository;
        this.walletRepository = walletRepository;
        this.priceService = priceService;
    }

    @Transactional
    public Order marketOrder(Long userId, String code, String side, long qty) {
        BigDecimal px = priceService.getPrice(code);

        Wallet w = walletRepository.findByUserId(userId).orElseThrow();
        Position pos = positionRepository.findByUserIdAndCode(userId, code)
                .orElseGet(() -> {
                    Position p = new Position();
                    p.setUserId(userId);
                    p.setCode(code);
                    p.setQuantity(0);
                    p.setAvgPrice(BigDecimal.ZERO);
                    return p;
                });

        if ("BUY".equalsIgnoreCase(side)) {
            BigDecimal cost = px.multiply(BigDecimal.valueOf(qty));
            if (w.getCash().compareTo(cost) < 0) throw new IllegalArgumentException("현금 부족");
            long newQty = pos.getQuantity() + qty;
            BigDecimal newAvg = pos.getAvgPrice().multiply(BigDecimal.valueOf(pos.getQuantity()))
                    .add(cost)
                    .divide(BigDecimal.valueOf(newQty), 2, RoundingMode.HALF_UP);
            pos.setQuantity(newQty);
            pos.setAvgPrice(newAvg);
            w.setCash(w.getCash().subtract(cost));
        } else if ("SELL".equalsIgnoreCase(side)) {
            if (pos.getQuantity() < qty) throw new IllegalArgumentException("보유 수량 부족");
            long newQty = pos.getQuantity() - qty;
            pos.setQuantity(newQty);
            if (newQty == 0) pos.setAvgPrice(BigDecimal.ZERO);
            BigDecimal proceeds = px.multiply(BigDecimal.valueOf(qty));
            w.setCash(w.getCash().add(proceeds));
        } else {
            throw new IllegalArgumentException("side는 BUY/SELL");
        }

        positionRepository.save(pos);
        walletRepository.save(w);

        Order o = new Order();
        o.setUserId(userId);
        o.setCode(code);
        o.setSide(side.toUpperCase());
        o.setQuantity(qty);
        o.setExecPrice(px);
        orderRepository.save(o);
        return o;
    }

    public Map<String, Object> portfolio(Long userId) {
        Wallet w = walletRepository.findByUserId(userId).orElseThrow();
        List<Position> positions = positionRepository.findByUserId(userId);
        BigDecimal equity = w.getCash();
        BigDecimal pnl = BigDecimal.ZERO;

        for (Position p : positions) {
            BigDecimal mkt = priceService.getPrice(p.getCode());
            BigDecimal value = mkt.multiply(BigDecimal.valueOf(p.getQuantity()));
            BigDecimal cost = p.getAvgPrice().multiply(BigDecimal.valueOf(p.getQuantity()));
            pnl = pnl.add(value.subtract(cost));
            equity = equity.add(value);
        }

        Map<String, Object> m = new HashMap<>();
        m.put("cash", w.getCash());
        m.put("equity", equity);
        m.put("pnl", pnl);
        m.put("positions", positions);
        return m;
    }
}
