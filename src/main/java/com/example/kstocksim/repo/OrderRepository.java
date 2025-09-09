package com.example.kstocksim.repo;

import com.example.kstocksim.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserIdOrderByExecutedAtDesc(Long userId);
}
