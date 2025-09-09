package com.example.kstocksim.repo;

import com.example.kstocksim.model.Position;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PositionRepository extends JpaRepository<Position, Long> {
    List<Position> findByUserId(Long userId);
    Optional<Position> findByUserIdAndCode(Long userId, String code);
}
