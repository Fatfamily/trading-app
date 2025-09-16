package com.example.kstocksim.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name="positions", uniqueConstraints = @UniqueConstraint(columnNames = {"userId","code"}))
public class Position {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false)
    private Long userId;

    @Column(nullable=false, length=10)
    private String code;

    @Column(nullable=false)
    private long quantity = 0;

    @Column(nullable=false, precision=19, scale=2)
    private BigDecimal avgPrice = BigDecimal.ZERO;

    public Position(){}

    public Position(Long userId, String code){
        this.userId = userId; this.code = code;
    }

    // getters/setters
    public Long getId(){ return id; }
    public Long getUserId(){ return userId; }
    public String getCode(){ return code; }
    public long getQuantity(){ return quantity; }
    public void setQuantity(long q){ quantity = q; }
    public java.math.BigDecimal getAvgPrice(){ return avgPrice; }
    public void setAvgPrice(java.math.BigDecimal p){ avgPrice = p; }
}
