package com.example.tradingapp;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.http.*; import java.net.URI; import java.util.*;

@RestController @RequestMapping("/api")
public class NewsController {
    private final HttpClient client = HttpClient.newHttpClient();
    @GetMapping("/news")
    public ResponseEntity<?> news(@RequestParam String query){
        String key = System.getenv("NEWSAPI_KEY");
        if (key==null || key.isBlank()){
            List<Map<String,String>> demo = List.of(
                Map.of("title","데모 뉴스: 가상 거래소 시작","url","https://example.com","source","DEMO"),
                Map.of("title","데모 뉴스: IT 섹터 강세","url","https://example.com","source","DEMO")
            ); return ResponseEntity.ok(demo);
        }
        try{
            String url = "https://newsapi.org/v2/everything?q="+java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8)
                +"&language=ko&sortBy=publishedAt&pageSize=10&apiKey="+key;
            HttpRequest req = HttpRequest.newBuilder(URI.create(url)).GET().build();
            HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            Map<String,Object> parsed = mapper.readValue(res.body(), Map.class);
            List<Map<String,Object>> arts = (List<Map<String,Object>>) parsed.getOrDefault("articles", List.of());
            List<Map<String,String>> out = new ArrayList<>();
            for (Map<String,Object> a : arts){
                Map<String,Object> src = (Map<String,Object>) a.getOrDefault("source", Map.of());
                out.add(Map.of("title", String.valueOf(a.getOrDefault("title","")), "url", String.valueOf(a.getOrDefault("url","")), "source", String.valueOf(src.getOrDefault("name",""))));
            }
            return ResponseEntity.ok(out);
        }catch(Exception e){ return ResponseEntity.status(500).body(Map.of("error","news fetch failed")); }
    }
}
