package com.example.kstocksim.controller;

import com.example.kstocksim.model.User;
import com.example.kstocksim.service.AuthService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {
    private final AuthService authService;
    public AuthController(AuthService authService){ this.authService = authService; }

    public record AuthReq(@NotBlank String username, @NotBlank String password){}

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthReq req, HttpSession session){
        User u = authService.register(req.username(), req.password());
        session.setAttribute("USER_ID", u.getId());
        return ResponseEntity.ok(Map.of("ok", true, "userId", u.getId()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthReq req, HttpSession session){
        return authService.login(req.username(), req.password())
                .map(u -> {
                    session.setAttribute("USER_ID", u.getId());
                    return ResponseEntity.ok(Map.of("ok", true, "userId", u.getId()));
                }).orElseGet(() -> ResponseEntity.status(401).body(Map.of("ok", false, "msg", "로그인 실패")));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session){
        session.invalidate();
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpSession session){
        Long uid = (Long) session.getAttribute("USER_ID");
        if(uid == null) return ResponseEntity.status(401).body(Map.of("ok", false));
        return ResponseEntity.ok(Map.of("ok", true, "userId", uid));
    }
}
