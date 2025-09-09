package com.example.kstocksim.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.concurrent.ThreadLocalRandom;

public class PriceUtil {

    // Approximate KRX tick size by price band (simplified)
    public static BigDecimal nearestTick(BigDecimal price) {
        long p = price.longValue();
        long step;
        if (p < 1000) step = 1;
        else if (p < 5000) step = 5;
        else if (p < 10000) step = 10;
        else if (p < 50000) step = 50;
        else if (p < 100000) step = 100;
        else step = 500;
        BigDecimal s = BigDecimal.valueOf(step);
        BigDecimal rounded = price.divide(s, 0, RoundingMode.HALF_UP).multiply(s);
        if (rounded.compareTo(BigDecimal.ONE) < 0) return s;
        return rounded;
    }

    public static BigDecimal randomWalk(BigDecimal last) {
        if (last == null || last.longValue() <= 0) return BigDecimal.valueOf(1000);
        long step;
        long p = last.longValue();
        if (p < 1000) step = 1;
        else if (p < 5000) step = 5;
        else if (p < 10000) step = 10;
        else if (p < 50000) step = 50;
        else if (p < 100000) step = 100;
        else step = 500;

        int k = ThreadLocalRandom.current().nextInt(-2, 3); // -2..+2 ticks
        long next = Math.max(step, p + k * step);
        return BigDecimal.valueOf(next);
    }
}
