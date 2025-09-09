package com.example.kstocksim.service;

import com.example.kstocksim.model.User;
import com.example.kstocksim.model.Wallet;
import com.example.kstocksim.repo.UserRepository;
import com.example.kstocksim.repo.WalletRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;

    @Value("${app.simulator.initialCash:10000000}")
    private BigDecimal initialCash;

    public AuthService(UserRepository userRepository, WalletRepository walletRepository) {
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
    }

    public User register(String username, String password) {
        if (userRepository.findByUsername(username).isPresent()) {
            throw new IllegalArgumentException("이미 존재하는 사용자명입니다.");
        }
        User u = new User();
        u.setUsername(username);
        u.setPasswordHash(BCrypt.hashpw(password, BCrypt.gensalt(10)));
        userRepository.save(u);

        Wallet w = new Wallet();
        w.setUserId(u.getId());
        w.setCash(initialCash);
        walletRepository.save(w);

        return u;
    }

    public Optional<User> login(String username, String password) {
        return userRepository.findByUsername(username)
                .filter(u -> BCrypt.checkpw(password, u.getPasswordHash()));
    }
}
