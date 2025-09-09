package com.example.kstocksim.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "wallets", indexes = @Index(columnList = "userId", unique = true))
public class Wallet {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal cash = BigDecimal.ZERO;

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public BigDecimal getCash() { return cash; }

    public void setId(Long id) { this.id = id; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setCash(BigDecimal cash) { this.cash = cash; }
}
