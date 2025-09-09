package com.example.kstocksim.controller;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
public class PriceController {

    @GetMapping("/price")
    public Map<String, Object> getPrice(@RequestParam String code) throws IOException {
        Map<String, Object> result = new HashMap<>();

        // 네이버 금융 종목 페이지 주소 (code는 6자리 숫자 종목코드)
        String url = "https://finance.naver.com/item/main.naver?code=" + code;

        Document doc = Jsoup.connect(url).get();
        Element priceEl = doc.selectFirst(".no_today .blind");

        if (priceEl != null) {
            result.put("price", priceEl.text());
        } else {
            result.put("price", "N/A");
        }

        result.put("code", code);
        return result;
    }
}
