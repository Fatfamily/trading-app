package com.example.kstocksim.controller;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/news")
public class NewsController {

    @GetMapping("/{code}")
    public ResponseEntity<?> news(@PathVariable String code){
        // Try to fetch headlines from Naver (best-effort). If it fails, return mocked news.
        try{
            String q = code;
            String url = "https://finance.naver.com/item/main.naver?code="+q;
            Document doc = Jsoup.connect(url).userAgent("Mozilla/5.0").timeout(3000).get();
            List<Map<String,String>> items = new ArrayList<>();
            doc.select(".news_area .news_item, .news_section .news_item").forEach(el->{
                String title = el.text();
                if(title.length()>0) items.add(Map.of("title", title));
            });
            if(items.isEmpty()){
                items.add(Map.of("title","(네이버에서 뉴스 확보 실패 — 목업 뉴스 제공)"));
            }
            return ResponseEntity.ok(items);
        }catch(Exception ex){
            List<Map<String,String>> items = List.of(
                Map.of("title","모의 뉴스: 시가총액 상위 종목 움직임 관찰됨"),
                Map.of("title","모의 뉴스: 경제지표/환율 변동")
            );
            return ResponseEntity.ok(items);
        }
    }
}
