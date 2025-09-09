package com.example.kstocksim.controller;

import com.example.kstocksim.model.Order;
import com.example.kstocksim.service.SimEngine;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sim")
@Validated
public class SimController {

    private final SimEngine simEngine;

    public SimController(SimEngine simEngine) {
        this.simEngine = simEngine;
    }

    public record OrderReq(@Pattern(regexp="\\d{6}") String code,
                           @Pattern(regexp="BUY|SELL") String side,
                           @Min(1) long qty) {}

    @PostMapping("/order")
    public ResponseEntity<?> order(@RequestBody OrderReq req, HttpSession session) {
        Long uid = (Long) session.getAttribute("USER_ID");
        if (uid == null) return ResponseEntity.status(401).body(Map.of("ok", false, "msg", "로그인 필요"));
        try {
            Order o = simEngine.marketOrder(uid, req.code(), req.side(), req.qty());
            return ResponseEntity.ok(Map.of("ok", true, "orderId", o.getId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "msg", e.getMessage()));
        }
    }

    @GetMapping("/portfolio")
    public ResponseEntity<?> portfolio(HttpSession session) {
        Long uid = (Long) session.getAttribute("USER_ID");
        if (uid == null) return ResponseEntity.status(401).body(Map.of("ok", false, "msg", "로그인 필요"));
        return ResponseEntity.ok(simEngine.portfolio(uid));
    }
}
