package com.example.kstocksim.controller;

import com.example.kstocksim.service.NewsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/news")
public class NewsController {
    private final NewsService newsService;

    public NewsController(NewsService newsService) {
        this.newsService = newsService;
    }

    @GetMapping("/{code}")
    public ResponseEntity<?> news(@PathVariable String code) {
        return ResponseEntity.ok(newsService.fetchNews(code));
    }
}
