package com.example.kstocksim.controller;

import com.example.kstocksim.model.User;
import com.example.kstocksim.service.AuthService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    public record AuthReq(@NotBlank String username, @NotBlank String password) {}

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthReq req, HttpSession session) {
        User u = authService.register(req.username(), req.password());
        session.setAttribute("USER_ID", u.getId());
        return ResponseEntity.ok(Map.of("ok", true, "userId", u.getId(), "username", u.getUsername()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthReq req, HttpSession session) {
        Optional<User> u = authService.login(req.username(), req.password());
        if (u.isPresent()) {
            session.setAttribute("USER_ID", u.get().getId());
            return ResponseEntity.ok(Map.of("ok", true, "userId", u.get().getId(), "username", u.get().getUsername()));
        }
        return ResponseEntity.status(401).body(Map.of("ok", false, "msg", "인증 실패"));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpSession session) {
        Long uid = (Long) session.getAttribute("USER_ID");
        if (uid == null) return ResponseEntity.status(401).body(Map.of("ok", false));
        return ResponseEntity.ok(Map.of("ok", true, "userId", uid));
    }
}
