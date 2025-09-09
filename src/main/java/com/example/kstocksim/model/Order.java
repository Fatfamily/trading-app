package com.example.kstocksim.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "orders", indexes = @Index(columnList = "userId,code"))
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 10)
    private String code;

    @Column(nullable = false, length = 4)
    private String side; // BUY or SELL

    @Column(nullable = false)
    private long quantity;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal execPrice;

    @Column(nullable = false)
    private Instant executedAt = Instant.now();

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getCode() { return code; }
    public String getSide() { return side; }
    public long getQuantity() { return quantity; }
    public BigDecimal getExecPrice() { return execPrice; }
    public Instant getExecutedAt() { return executedAt; }

    public void setId(Long id) { this.id = id; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setCode(String code) { this.code = code; }
    public void setSide(String side) { this.side = side; }
    public void setQuantity(long quantity) { this.quantity = quantity; }
    public void setExecPrice(BigDecimal execPrice) { this.execPrice = execPrice; }
    public void setExecutedAt(Instant executedAt) { this.executedAt = executedAt; }
}
