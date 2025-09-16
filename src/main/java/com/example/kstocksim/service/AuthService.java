package com.example.kstocksim.service;

import com.example.kstocksim.model.User;
import com.example.kstocksim.repo.UserRepository;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService {
    private final UserRepository userRepo;
    public AuthService(UserRepository userRepo){ this.userRepo = userRepo; }

    public User register(String username, String password){
        if(userRepo.findByUsername(username).isPresent()) throw new IllegalArgumentException("이미 존재하는 아이디");
        String hash = BCrypt.hashpw(password, BCrypt.gensalt());
        User u = new User(username, hash);
        return userRepo.save(u);
    }

    public Optional<User> login(String username, String password){
        return userRepo.findByUsername(username)
                .filter(u -> BCrypt.checkpw(password, u.getPasswordHash()));
    }
}
