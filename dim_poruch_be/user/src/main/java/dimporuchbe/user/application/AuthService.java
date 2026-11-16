package dimporuchbe.user.application;

import dimporuchbe.security.config.JwtService;
import dimporuchbe.user.api.dtos.LoginRequestDto;
import dimporuchbe.user.api.dtos.RegisterRequestDto;
import dimporuchbe.user.api.dtos.LogoutResponseDto;
import dimporuchbe.user.api.dtos.RefreshTokenRequestDto;
import dimporuchbe.user.api.dtos.LoginResponseDto;
import dimporuchbe.user.api.dtos.RegisterResponseDto;
import dimporuchbe.user.persistence.Role;
import dimporuchbe.user.persistence.Token;
import dimporuchbe.user.persistence.TokenRepository;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final TokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager manager;

    @Transactional
    public RegisterResponseDto registerUser(RegisterRequestDto dto){
        if (userRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Електрона пошта зайнята");
        }

        Role role = (dto.getRole() == Role.LANDLORD) ? Role.LANDLORD : Role.TENANT;

        User user = User.builder()
                .email(dto.getEmail())
                .password(passwordEncoder.encode(dto.getPassword()))
                .role(role)
                .status("ACTIVE")
                .build();

        userRepository.save(user);

        return RegisterResponseDto.builder()
                .message("Користувача " + user.getEmail() + " успішно зареєстровано")
                .build();
    }

    @Transactional
    public LoginResponseDto loginUser(LoginRequestDto dto){
        manager.authenticate(
                new UsernamePasswordAuthenticationToken(dto.getEmail(), dto.getPassword())
        );

        User user = userRepository.findByEmail(dto.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Користувача не знайдено"));

        if (!user.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Обліковий запис заблокований");
        }

        String accessToken = jwtService.generateToken(user.getEmail(), user.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(dto.getEmail(), user.getRole().name());

        saveUserToken(user, accessToken);
        saveUserToken(user, refreshToken);

        return LoginResponseDto.builder()
                .message("Користувач " + dto.getEmail() + " успішно увійшов!")
                .jwt_token(accessToken)
                .refresh_token(refreshToken)
                .build();
    }

    @Transactional
    public LoginResponseDto refreshToken(RefreshTokenRequestDto dto){
        String refreshToken = dto.getRefreshToken();
        String email = jwtService.extractEmail(refreshToken);

        if (email == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        if (!user.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is disabled");
        }

        boolean isTokenValid = jwtService.isTokenValid(refreshToken, email);
        boolean isNotRevoked = tokenRepository.findByToken(refreshToken)
                .map(t -> !t.isRevoked() && !t.isExpired())
                .orElse(false);

        if (!isTokenValid || !isNotRevoked) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token is expired or revoked");
        }

        String newAccessToken = jwtService.generateToken(email, user.getRole().name());
        saveUserToken(user, newAccessToken);

        return LoginResponseDto.builder()
                .message("Токен доступу успішно оновлено")
                .jwt_token(newAccessToken)
                .refresh_token(refreshToken)
                .build();
    }

    @Transactional
    public LogoutResponseDto logoutUser(HttpServletRequest request){
        String authHeader = request.getHeader("Authorization");
        if(authHeader == null || !authHeader.startsWith("Bearer ")){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing or invalid Authorization header");
        }

        String jwt = authHeader.substring(7);
        Token storedToken = tokenRepository.findByToken(jwt)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token not found"));

        if (!storedToken.isRevoked() && !storedToken.isExpired()) {
            storedToken.setRevoked(true);
            storedToken.setExpired(true);
            tokenRepository.save(storedToken);
        }

        SecurityContextHolder.clearContext();

        HttpSession session = request.getSession(false);
        if(session != null){
            session.invalidate();
        }

        return LogoutResponseDto.builder()
                .message("Ви успішно вийшли із системи")
                .build();
    }

    private void saveUserToken(User user, String jwt){
        Token token = Token.builder()
                .user(user)
                .token(jwt)
                .expired(false)
                .revoked(false)
                .build();
        tokenRepository.save(token);
    }
}
