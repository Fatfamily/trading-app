package com.example.kstocksim.controller;

import com.example.kstocksim.service.PriceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/price")
public class PriceController {
    private final PriceService priceService;
    public PriceController(PriceService priceService){ this.priceService = priceService; }

    @GetMapping("/{code}")
    public ResponseEntity<?> price(@PathVariable String code){
        return ResponseEntity.ok(Map.of("price", priceService.getPrice(code)));
    }

    @GetMapping("/batch")
    public ResponseEntity<?> batch(@RequestParam String codes){
        String[] arr = codes.split(",");
        Map<String, Object> out = new HashMap<>();
        for(String c : arr){
            c = c.trim();
            if(c.matches("\d{6}")){
                out.put(c, Map.of("price", priceService.getPrice(c)));
            }
        }
        return ResponseEntity.ok(out);
    }
}
