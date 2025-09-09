package com.example.kstocksim.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class NewsService {

    private final ObjectMapper om = new ObjectMapper();

    public List<Map<String, String>> fetchNews(String code) {
        // Try mobile JSON first (unofficial; may change)
        try {
            String url = "https://m.stock.naver.com/api/news/stock/" + code + "?pageSize=20&page=1";
            String body = Jsoup.connect(url)
                    .ignoreContentType(true)
                    .header("User-Agent", "Mozilla/5.0")
                    .header("Referer", "https://m.stock.naver.com/")
                    .timeout(4000).method(Connection.Method.GET).execute().body();
            JsonNode arr = om.readTree(body);
            List<Map<String, String>> list = new ArrayList<>();
            if (arr.isArray()) {
                for (JsonNode n : arr) {
                    String title = n.has("title") ? n.get("title").asText() : null;
                    String link = n.has("linkUrl") ? n.get("linkUrl").asText() : null;
                    String press = n.has("officeName") ? n.get("officeName").asText() : "";
                    if (title != null && link != null) {
                        list.add(Map.of("title", title, "url", link, "press", press));
                    }
                }
            }
            if (!list.isEmpty()) return list;
        } catch (Exception ignored) {}

        // Fallback: scrape HTML list
        try {
            String url2 = "https://finance.naver.com/item/news_news.nhn?code=" + code + "&page=1&sm=title_entity_id.basic";
            Document doc = Jsoup.connect(url2).timeout(5000).get();
            List<Map<String, String>> list = new ArrayList<>();
            for (Element a : doc.select("table.type5 a[href*='read']")) {
                String title = a.text();
                String href = "https://finance.naver.com" + a.attr("href");
                if (!title.isBlank()) {
                    list.add(Map.of("title", title, "url", href, "press", ""));
                }
                if (list.size() >= 15) break;
            }
            return list;
        } catch (Exception e) {
            // Return empty on failure
        }
        return List.of();
    }
}
