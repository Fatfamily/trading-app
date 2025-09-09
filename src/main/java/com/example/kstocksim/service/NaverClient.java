package com.example.kstocksim.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

@Component
public class NaverClient {

    @Value("${app.naver.itemSummaryUrl}")
    private String itemSummaryUrl;

    @Value("${app.naver.historyUrl}")
    private String historyUrl;

    @Value("${app.naver.userAgent}")
    private String userAgent;

    private final ObjectMapper om = new ObjectMapper();

    public Optional<BigDecimal> fetchCurrentPrice(String code) {
        // 1) Try itemSummary (has "now")
        try {
            String url = String.format(itemSummaryUrl, code);
            String body = Jsoup.connect(url)
                    .ignoreContentType(true)
                    .header("User-Agent", userAgent)
                    .timeout(4000)
                    .method(Connection.Method.GET)
                    .execute()
                    .body();
            JsonNode node = om.readTree(body);
            if (node.has("now")) {
                return Optional.of(new BigDecimal(node.get("now").asText()));
            }
        } catch (Exception ignored) {}

        // 2) Fallback to history endpoint
        try {
            String url2 = String.format(historyUrl, code);
            String body2 = Jsoup.connect(url2)
                    .ignoreContentType(true)
                    .header("User-Agent", userAgent)
                    .header("Referer", "https://m.stock.naver.com/")
                    .timeout(4000)
                    .method(Connection.Method.GET)
                    .execute()
                    .body();
            JsonNode arr = om.readTree(body2);
            if (arr.isArray() && arr.size() > 0) {
                JsonNode last = arr.get(0);
                if (last.has("closePrice")) {
                    return Optional.of(new BigDecimal(last.get("closePrice").asText()));
                } else if (last.has("close")) {
                    return Optional.of(new BigDecimal(last.get("close").asText()));
                }
            }
        } catch (Exception ignored) {}

        return Optional.empty();
    }
}
