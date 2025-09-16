package com.example.kstocksim.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name="orders")
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String code;
    private long qty;
    private String side; // BUY|SELL
    private BigDecimal price;
    private Instant createdAt = Instant.now();

    public Order(){}

    public Order(Long userId, String code, long qty, String side, BigDecimal price){
        this.userId = userId; this.code = code; this.qty = qty; this.side = side; this.price = price;
    }

    public Long getId(){ return id;}
    public Long getUserId(){ return userId; }
    public String getCode(){ return code; }
    public long getQty(){ return qty; }
    public String getSide(){ return side; }
    public BigDecimal getPrice(){ return price; }
    public Instant getCreatedAt(){ return createdAt; }
}
