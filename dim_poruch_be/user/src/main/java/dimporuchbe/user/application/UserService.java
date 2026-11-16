package dimporuchbe.user.application;

import dimporuchbe.user.api.dtos.ChangePasswordRequestDto;
import dimporuchbe.user.api.dtos.UserProfileDto;
import dimporuchbe.user.api.dtos.UserPublicProfileDto;
import dimporuchbe.user.persistence.Token;
import dimporuchbe.user.persistence.TokenRepository;
import dimporuchbe.user.persistence.User;
import dimporuchbe.user.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final TokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;

    public UserProfileDto getUser(String email) {
        User user = findUserByEmail(email);

        return UserProfileDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .build();
    }

    public UserPublicProfileDto getPublicProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        return UserPublicProfileDto.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .role(user.getRole())
                .memberSince(user.getCreatedAt())
                .build();
    }

    @Transactional
    public UserProfileDto updateProfile(String currentEmail, UserProfileDto dto) {
        User user = findUserByEmail(currentEmail);

        if (dto.getEmail() != null && !dto.getEmail().equalsIgnoreCase(currentEmail)) {
            if (userRepository.findByEmail(dto.getEmail()).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already taken");
            }
            user.setEmail(dto.getEmail());
        }

        if (dto.getFullName() != null) {
            user.setFullName(dto.getFullName());
        }

        if (dto.getPhone() != null) {
            user.setPhone(dto.getPhone());
        }

        userRepository.save(user);

        return UserProfileDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole())
                .build();
    }

    @Transactional
    public void changePassword(String email, ChangePasswordRequestDto dto) {
        User user = findUserByEmail(email);

        if (!passwordEncoder.matches(dto.getCurrentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password does not match");
        }

        if (passwordEncoder.matches(dto.getNewPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must be different from current password");
        }

        user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        userRepository.save(user);

        revokeAllUserTokens(user);
    }

    @Transactional
    public void deactivateAccount(String email) {
        User user = findUserByEmail(email);

        user.setStatus("DEACTIVATED");
        userRepository.save(user);

        revokeAllUserTokens(user);
        SecurityContextHolder.clearContext();
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void revokeAllUserTokens(User user) {
        List<Token> validTokens = tokenRepository.findAllValidTokensByUser(user.getId());
        if (!validTokens.isEmpty()) {
            validTokens.forEach(t -> {
                t.setRevoked(true);
                t.setExpired(true);
            });
            tokenRepository.saveAll(validTokens);
        }
    }
}
