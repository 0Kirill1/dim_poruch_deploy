package dimporuchbe.user.application;

import dimporuchbe.security.config.TokenRevocationService;
import dimporuchbe.user.persistence.TokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DatabaseTokenRevocationService implements TokenRevocationService {
    private final TokenRepository tokenRepository;

    @Override
    public boolean isTokenRevoked(String token) {
        return tokenRepository.findByToken(token)
                .map(t -> t.isRevoked() || t.isExpired())
                .orElse(true);
    }
}
