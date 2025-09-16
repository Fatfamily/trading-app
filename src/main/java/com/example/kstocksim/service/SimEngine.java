package com.example.kstocksim.service;

import com.example.kstocksim.model.*;
import com.example.kstocksim.repo.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class SimEngine {
    private final WalletRepository walletRepo;
    private final PositionRepository positionRepo;
    private final OrderRepository orderRepo;
    private final PriceService priceService;

    public SimEngine(WalletRepository walletRepo, PositionRepository positionRepo, OrderRepository orderRepo, PriceService priceService){
        this.walletRepo=walletRepo; this.positionRepo=positionRepo; this.orderRepo=orderRepo; this.priceService=priceService;
    }

    @Transactional
    public Order marketOrder(Long userId, String code, String side, long qty){
        if(qty <= 0) throw new IllegalArgumentException("qty>0 필요");
        BigDecimal price = priceService.getPrice(code);
        BigDecimal cost = price.multiply(BigDecimal.valueOf(qty));
        Wallet w = walletRepo.findByUserId(userId).orElseGet(()->{
            Wallet nw = new Wallet(userId);
            nw.setCash(BigDecimal.valueOf(1000000));
            return walletRepo.save(nw);
        });
        if(side.equalsIgnoreCase("BUY")){
            if(w.getCash().compareTo(cost) < 0) throw new IllegalArgumentException("잔액 부족");
            w.setCash(w.getCash().subtract(cost));
            walletRepo.save(w);
            Position pos = positionRepo.findByUserIdAndCode(userId, code).orElseGet(()->{
                Position p = new Position(userId, code);
                p.setQuantity(0);
                p.setAvgPrice(BigDecimal.ZERO);
                return p;
            });
            // update average price
            long existing = pos.getQuantity();
            BigDecimal existingCost = pos.getAvgPrice().multiply(BigDecimal.valueOf(existing));
            BigDecimal newQty = BigDecimal.valueOf(qty);
            BigDecimal newAvg = existingCost.add(cost).divide(BigDecimal.valueOf(existing + qty), 2, BigDecimal.ROUND_HALF_UP);
            pos.setQuantity(existing + qty);
            pos.setAvgPrice(newAvg);
            positionRepo.save(pos);
        } else {
            // SELL
            Position pos = positionRepo.findByUserIdAndCode(userId, code).orElseThrow(()-> new IllegalArgumentException("보유수량 없음"));
            if(pos.getQuantity() < qty) throw new IllegalArgumentException("보유수량 부족");
            pos.setQuantity(pos.getQuantity() - qty);
            positionRepo.save(pos);
            w.setCash(w.getCash().add(cost));
            walletRepo.save(w);
        }
        Order o = new Order(userId, code, qty, side.toUpperCase(), price);
        return orderRepo.save(o);
    }

    public Wallet getWallet(Long userId){
        return walletRepo.findByUserId(userId).orElseGet(()->{
            Wallet nw = new Wallet(userId);
            nw.setCash(BigDecimal.valueOf(1000000));
            return walletRepo.save(nw);
        });
    }

    public List<Position> getPositions(Long userId){
        return positionRepo.findByUserId(userId);
    }
}
