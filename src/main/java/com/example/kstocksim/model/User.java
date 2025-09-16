package com.example.kstocksim.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(columnNames = "username"))
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false, length=80)
    private String username;

    @Column(nullable=false, length=255)
    private String passwordHash;

    @Column(nullable=false)
    private Instant createdAt = Instant.now();

    public User() {}

    public User(String username, String passwordHash) {
        this.username = username;
        this.passwordHash = passwordHash;
    }

    // getters/setters
    public Long getId(){ return id; }
    public String getUsername(){ return username; }
    public void setUsername(String v){ username = v; }
    public String getPasswordHash(){ return passwordHash; }
    public void setPasswordHash(String v){ passwordHash = v; }
    public Instant getCreatedAt(){ return createdAt; }
}
