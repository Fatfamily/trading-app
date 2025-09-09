package com.example.kstocksim.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "positions", indexes = @Index(columnList = "userId,code", unique = true))
public class Position {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 10)
    private String code; // KRX code like 005930

    @Column(nullable = false)
    private long quantity; // shares

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal avgPrice = BigDecimal.ZERO;

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getCode() { return code; }
    public long getQuantity() { return quantity; }
    public BigDecimal getAvgPrice() { return avgPrice; }

    public void setId(Long id) { this.id = id; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setCode(String code) { this.code = code; }
    public void setQuantity(long quantity) { this.quantity = quantity; }
    public void setAvgPrice(BigDecimal avgPrice) { this.avgPrice = avgPrice; }
}
